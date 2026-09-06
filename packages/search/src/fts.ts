import type { AdapterRegistry, TranscriptAdapter } from "@transcripts-mcp/core";

import type { BuildIndexOptions, SearchHit, SearchQuery, SearchScope } from "./types.ts";

import { Database } from "bun:sqlite";
import { mkdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { z } from "zod";

import { toolContracts } from "@transcripts-mcp/contracts";
import {
  normalizeCwd,
  readJsonlLines,
  resolveTranscriptRoot,
  slugifyCwd,
} from "@transcripts-mcp/core";

import { schemaVersion, schemaVersionKey } from "./constants.ts";
import {
  deleteEmbeddings,
  embedCorpus,
  embedQuery,
  ensureSemanticSchema,
  fuseHits,
  loadSqliteVec,
  markSemanticIncomplete,
  searchVectors,
  semanticIndexComplete,
} from "./semantic.ts";
import { normalizeSearchQueryDates } from "./utils.ts";

const schema = `
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS files (
  path TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  source_root TEXT NOT NULL,
  session_id TEXT NOT NULL,
  cwd TEXT,
  cwd_norm TEXT,
  project_slug TEXT,
  mtime_ms INTEGER NOT NULL,
  size_bytes INTEGER NOT NULL
);
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  text,
  provider UNINDEXED,
  source_root UNINDEXED,
  role UNINDEXED,
  cwd UNINDEXED,
  cwd_norm UNINDEXED,
  project_slug UNINDEXED,
  session_id UNINDEXED,
  path UNINDEXED,
  line_number UNINDEXED,
  timestamp UNINDEXED,
  effective_timestamp UNINDEXED,
  tokenize = 'porter'
);
`;

const fileRowSchema = z.object({
  path: z.string(),
  provider: z.string(),
  source_root: z.string(),
  mtime_ms: z.number(),
  size_bytes: z.number(),
});

const searchRowSchema = z.object({
  text: z.string(),
  provider: z.string(),
  role: z.string(),
  cwd: z.string().nullable(),
  session_id: z.string(),
  path: z.string(),
  line_number: z.number(),
  timestamp: z.string().nullable(),
  rank: z.number(),
});

export interface BuildIndexResult {
  files: number;
  messages: number;
  skipped: number;
  semantic: boolean;
}

let loggedHybridFallback = false;

export class TranscriptIndex {
  readonly #db: Database;
  #sqliteVecLoaded: boolean | undefined;

  constructor(dbPath = defaultIndexPath()) {
    this.#db = new Database(dbPath, { create: true });
    this.#ensureSchema();
  }

  close(): void {
    this.#db.close();
  }

  semanticAvailable(): boolean {
    return semanticIndexComplete(this.#db);
  }

  async build(
    registry: AdapterRegistry,
    options: BuildIndexOptions | boolean = {},
  ): Promise<BuildIndexResult> {
    const resolved = resolveBuildOptions(options);

    const previous = new Map<
      string,
      { provider: string; root: string; mtimeMs: number; sizeBytes: number }
    >();
    for (const row of this.#db
      .query("SELECT path, provider, source_root, mtime_ms, size_bytes FROM files")
      .all()) {
      const parsed = fileRowSchema.safeParse(row);
      if (!parsed.success) continue;
      previous.set(parsed.data.path, {
        provider: parsed.data.provider,
        root: parsed.data.source_root,
        mtimeMs: parsed.data.mtime_ms,
        sizeBytes: parsed.data.size_bytes,
      });
    }

    let files = 0;
    let messages = 0;
    let skipped = 0;
    const seen = new Set<string>();

    for (const adapter of registry.list()) {
      if (!(await adapter.isAvailable())) continue;
      const sourceRoot = await resolveTranscriptRoot(adapter.root());
      for await (const summary of adapter.listSessions({})) {
        seen.add(summary.path);
        const info = await stat(summary.path);
        const prior = previous.get(summary.path);
        if (
          !resolved.full &&
          prior !== undefined &&
          prior.provider === adapter.id &&
          prior.root === sourceRoot &&
          prior.mtimeMs === info.mtimeMs &&
          prior.sizeBytes === info.size
        ) {
          skipped += 1;
          continue;
        }
        messages += await this.#indexFile(
          adapter,
          sourceRoot,
          summary.path,
          summary.cwd,
          summary.projectSlug,
          info.mtimeMs,
          info.size,
        );
        files += 1;
      }
    }

    for (const path of previous.keys()) {
      if (!seen.has(path)) this.#deleteFile(path);
    }

    if (resolved.semantic) {
      await embedCorpus(this.#db);
    }

    return { files, messages, skipped, semantic: this.semanticAvailable() };
  }

  search(query: SearchQuery, scopes: SearchScope[]): SearchHit[] {
    const normalizedQuery = normalizeSearchQueryDates(query);
    return this.#searchFts(
      normalizedQuery,
      normalizedQuery.limit ?? toolContracts.searchTranscripts.inputs.limit.default,
      scopes,
    );
  }

  async searchHybrid(query: SearchQuery, scopes: SearchScope[]): Promise<SearchHit[]> {
    const normalizedQuery = normalizeSearchQueryDates(query);
    const limit = normalizedQuery.limit ?? toolContracts.searchTranscripts.inputs.limit.default;
    const ftsHits = this.#searchFts(normalizedQuery, limit, scopes);
    if (!this.semanticAvailable()) {
      logHybridFallback("no embeddings in index");
      return ftsHits;
    }
    const embedding = await embedQuery(normalizedQuery.query);
    if (embedding === undefined) {
      logHybridFallback("embed query failed");
      return ftsHits;
    }
    const useSqliteVec = await this.#ensureSqliteVec();
    return fuseHits(
      ftsHits,
      searchVectors(this.#db, embedding, normalizedQuery, limit, useSqliteVec, scopes),
      limit,
    );
  }

  async #ensureSqliteVec(): Promise<boolean> {
    if (this.#sqliteVecLoaded !== undefined) return this.#sqliteVecLoaded;
    this.#sqliteVecLoaded = await loadSqliteVec(this.#db);
    return this.#sqliteVecLoaded;
  }

  #searchFts(query: SearchQuery, limit: number, scopes: SearchScope[]): SearchHit[] {
    if (scopes.length === 0) return [];
    const filters = ["messages_fts MATCH ?"];
    const params: Array<string | number> = [escapeFtsQuery(query.query)];
    appendScopeFilter(filters, params, scopes);
    if (query.provider !== undefined) {
      filters.push("provider = ?");
      params.push(query.provider);
    }
    if (query.role !== undefined) {
      filters.push("role = ?");
      params.push(query.role);
    }
    if (query.cwd !== undefined) {
      filters.push("(cwd_norm = ? OR project_slug = ?)");
      params.push(normalizeCwd(query.cwd), slugifyCwd(query.cwd));
    }
    if (query.since !== undefined) {
      filters.push("effective_timestamp >= ?");
      params.push(query.since);
    }
    if (query.until !== undefined) {
      filters.push("effective_timestamp <= ?");
      params.push(query.until);
    }
    params.push(limit);
    const sql = `
      SELECT text, provider, role, cwd, session_id, path, line_number, timestamp, bm25(messages_fts) AS rank
      FROM messages_fts
      WHERE ${filters.join(" AND ")}
      ORDER BY rank
      LIMIT ?
    `;
    const hits: SearchHit[] = [];
    for (const row of this.#db.query(sql).all(...params)) {
      const parsed = searchRowSchema.safeParse(row);
      if (!parsed.success) continue;
      hits.push({
        provider: parsed.data.provider,
        sessionId: parsed.data.session_id,
        path: parsed.data.path,
        lineNumber: parsed.data.line_number,
        role: parsed.data.role,
        text: parsed.data.text,
        cwd: parsed.data.cwd ?? undefined,
        timestamp: parsed.data.timestamp ?? undefined,
        score: parsed.data.rank,
      });
    }
    return hits;
  }

  async #indexFile(
    adapter: TranscriptAdapter,
    sourceRoot: string,
    path: string,
    summaryCwd: string | undefined,
    projectSlug: string | undefined,
    mtimeMs: number,
    sizeBytes: number,
  ): Promise<number> {
    const sessionId = adapter.sessionIdFromPath(path);
    let cwd = summaryCwd;
    const pending: Array<{
      text: string;
      role: string;
      lineNumber: number;
      timestamp: string | null;
      effectiveTimestamp: string;
    }> = [];
    let lineNumber = 0;
    for await (const text of readJsonlLines(path)) {
      lineNumber += 1;
      if (text.trim().length === 0) continue;
      cwd ??= adapter.cwdFromRawLine(text);
      const message = adapter.parseRawLine(text);
      if (message === null) continue;
      pending.push({
        text: message.text,
        role: message.role,
        lineNumber,
        timestamp: message.timestamp?.toISOString() ?? null,
        effectiveTimestamp: message.timestamp?.toISOString() ?? new Date(mtimeMs).toISOString(),
      });
    }
    const cwdNorm = cwd === undefined ? null : normalizeCwd(cwd);
    const slug = projectSlug ?? null;
    const insert = this.#db.prepare(
      `INSERT INTO messages_fts (text, provider, source_root, role, cwd, cwd_norm, project_slug, session_id, path, line_number, timestamp, effective_timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    this.#db.transaction(() => {
      this.#deleteFile(path);
      for (const row of pending) {
        insert.run(
          row.text,
          adapter.id,
          sourceRoot,
          row.role,
          cwd ?? null,
          cwdNorm,
          slug,
          sessionId,
          path,
          row.lineNumber,
          row.timestamp,
          row.effectiveTimestamp,
        );
      }
      this.#db
        .prepare(
          `INSERT INTO files (path, provider, source_root, session_id, cwd, cwd_norm, project_slug, mtime_ms, size_bytes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          path,
          adapter.id,
          sourceRoot,
          sessionId,
          cwd ?? null,
          cwdNorm,
          slug,
          mtimeMs,
          sizeBytes,
        );
    })();
    return pending.length;
  }

  #deleteFile(path: string): void {
    this.#db.run("DELETE FROM messages_fts WHERE path = ?", [path]);
    this.#db.run("DELETE FROM files WHERE path = ?", [path]);
    deleteEmbeddings(this.#db, path);
    markSemanticIncomplete(this.#db);
  }

  #ensureSchema(): void {
    this.#db.exec("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
    const row = this.#db.query("SELECT value FROM meta WHERE key = ?").get(schemaVersionKey);
    const parsed = z.object({ value: z.string() }).safeParse(row);
    const current = parsed.success ? parsed.data.value : undefined;
    if (current !== String(schemaVersion)) {
      this.#dropSearchTables();
    }
    this.#db.exec(schema);
    ensureSemanticSchema(this.#db);
    if (current !== String(schemaVersion)) {
      this.#db.run("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", [
        schemaVersionKey,
        String(schemaVersion),
      ]);
    }
  }

  #dropSearchTables(): void {
    this.#db.exec("DROP TABLE IF EXISTS messages_fts");
    this.#db.exec("DROP TABLE IF EXISTS files");
    this.#db.exec("DROP TABLE IF EXISTS embeddings");
    markSemanticIncomplete(this.#db);
  }
}

function logHybridFallback(reason: string): void {
  if (loggedHybridFallback) return;
  loggedHybridFallback = true;
  console.error(`search_transcripts hybrid falling back to fts: ${reason}`);
}

function defaultIndexPath(): string {
  return process.env.TRANSCRIPTS_MCP_INDEX ?? join(homedir(), ".transcripts-mcp", "index.db");
}

async function ensureIndexDir(dbPath = defaultIndexPath()): Promise<string> {
  await mkdir(dirname(dbPath), { recursive: true });
  return dbPath;
}

export async function buildIndex(
  registry: AdapterRegistry,
  options: BuildIndexOptions = {},
): Promise<BuildIndexResult> {
  const dbPath = await ensureIndexDir();
  const index = new TranscriptIndex(dbPath);
  try {
    return await index.build(registry, options);
  } finally {
    index.close();
  }
}

export async function searchTranscripts(
  registry: AdapterRegistry,
  query: SearchQuery,
): Promise<SearchHit[]> {
  const scopes = await resolveSearchScopes(registry);
  const index = new TranscriptIndex();
  try {
    if (query.mode === "hybrid") return await index.searchHybrid(query, scopes);
    return index.search(query, scopes);
  } finally {
    index.close();
  }
}

async function resolveSearchScopes(registry: AdapterRegistry): Promise<SearchScope[]> {
  const adapters = await registry.listAvailable();
  return Promise.all(
    adapters.map(async (adapter) => ({
      provider: adapter.id,
      root: await resolveTranscriptRoot(adapter.root()),
    })),
  );
}

function appendScopeFilter(
  filters: string[],
  params: Array<string | number>,
  scopes: SearchScope[],
): void {
  filters.push(`(${scopes.map(() => "(provider = ? AND source_root = ?)").join(" OR ")})`);
  for (const scope of scopes) {
    params.push(scope.provider, scope.root);
  }
}

function resolveBuildOptions(options: BuildIndexOptions | boolean): BuildIndexOptions {
  if (options === true) return { semantic: true };
  if (options === false) return {};
  return options;
}

function escapeFtsQuery(query: string): string {
  const trimmed = query.trim();
  if (trimmed.length === 0) return '""';
  const escaped = trimmed.replaceAll('"', '""');
  return `"${escaped}"`;
}

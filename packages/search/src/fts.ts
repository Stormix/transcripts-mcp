import type { AdapterRegistry, TranscriptAdapter } from "@transcripts-mcp/core";

import type { BuildIndexOptions, SearchHit, SearchQuery, SearchScope } from "./types.ts";

import { Database } from "bun:sqlite";
import { mkdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { setImmediate } from "node:timers/promises";

import { z } from "zod";

import { toolContracts } from "@transcripts-mcp/contracts";
import {
  normalizeCwd,
  readJsonlLines,
  resolveTranscriptRoot,
  slugifyCwd,
} from "@transcripts-mcp/core";

import { schemaVersion, schemaVersionKey } from "./constants.ts";
import { IndexRebuildRequiredError } from "./errors.ts";
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
  size_bytes INTEGER NOT NULL,
  first_message_rowid INTEGER,
  last_message_rowid INTEGER
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

const schemaRebuildRequiredKey = "schema_rebuild_required";

const fileRowSchema = z.object({
  path: z.string(),
  provider: z.string(),
  source_root: z.string(),
  mtime_ms: z.number(),
  size_bytes: z.number(),
});

const messageBoundsSchema = z
  .object({
    first_message_rowid: z.number().nullable(),
    last_message_rowid: z.number().nullable(),
  })
  .nullable();

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
  schemaReset?: SchemaReset;
}

export interface SchemaReset {
  /** Previous schema version when valid version metadata was available. */
  fromVersion?: number;
  /** Schema version installed by the successful build. */
  toVersion: number;
}

type IndexOpenIntent = "build" | "search";
interface PendingSchemaReset {
  metaType?: "table" | "view";
  sourceVersion?: string;
}

let loggedHybridFallback = false;

export class TranscriptIndex {
  readonly #db: Database;
  #pendingSchemaReset: PendingSchemaReset | undefined = undefined;
  #schemaReset: SchemaReset | undefined = undefined;
  #sqliteVecLoaded: boolean | undefined;

  private constructor(dbPath: string, intent: IndexOpenIntent) {
    this.#db = new Database(dbPath, { create: true });
    try {
      this.#ensureSchema(intent);
    } catch (error) {
      this.#db.close();
      throw error;
    }
  }

  /** Opens an index for non-destructive search and compatibility inspection. */
  static open(dbPath = defaultIndexPath()): TranscriptIndex {
    return new TranscriptIndex(dbPath, "search");
  }

  /** Opens an index for building; incompatible tables remain intact until `build()` starts. */
  static openForBuild(dbPath = defaultIndexPath()): TranscriptIndex {
    return new TranscriptIndex(dbPath, "build");
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
    resolved.signal?.throwIfAborted();
    this.#prepareSchemaReset();

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
    const report = async (pendingMessages = 0) => {
      resolved.signal?.throwIfAborted();
      await resolved.onProgress?.({
        phase: "indexing",
        files,
        messages: messages + pendingMessages,
        skipped,
        embedded: 0,
      });
      resolved.signal?.throwIfAborted();
    };
    await report();

    for (const adapter of registry.list()) {
      resolved.signal?.throwIfAborted();
      if (!(await adapter.isAvailable())) continue;
      const sourceRoot = await resolveTranscriptRoot(adapter.root());
      for await (const summary of adapter.listSessions({})) {
        resolved.signal?.throwIfAborted();
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
          await report();
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
          resolved.signal,
          report,
        );
        files += 1;
        await report();
      }
    }

    for (const path of previous.keys()) {
      resolved.signal?.throwIfAborted();
      if (!seen.has(path)) {
        this.#deleteFile(path);
        await setImmediate();
        await report();
      }
    }

    let embedded = 0;
    if (resolved.semantic) {
      await embedCorpus(this.#db, undefined, {
        signal: resolved.signal,
        onProgress: async (count) => {
          embedded = count;
          await resolved.onProgress?.({ phase: "embedding", files, messages, skipped, embedded });
        },
      });
    }

    resolved.signal?.throwIfAborted();
    const schemaReset = this.#completeSchemaReset();
    await resolved.onProgress?.({ phase: "complete", files, messages, skipped, embedded });

    return {
      files,
      messages,
      skipped,
      semantic: this.semanticAvailable(),
      schemaReset,
    };
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
    signal: AbortSignal | undefined,
    onProgress: (messages: number) => Promise<void>,
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
      signal?.throwIfAborted();
      lineNumber += 1;
      if (lineNumber % 256 === 0) {
        await setImmediate();
        await onProgress(pending.length);
      }
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
    const insert = this.#db.query(
      `INSERT INTO messages_fts (text, provider, source_root, role, cwd, cwd_norm, project_slug, session_id, path, line_number, timestamp, effective_timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    this.#db.transaction(() => {
      signal?.throwIfAborted();
      this.#deleteFile(path);
      let firstRowid: number | bigint | null = null;
      let lastRowid: number | bigint | null = null;
      for (const row of pending) {
        const inserted = insert.run(
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
        firstRowid ??= inserted.lastInsertRowid;
        lastRowid = inserted.lastInsertRowid;
      }
      this.#db
        .query(
          `INSERT INTO files (path, provider, source_root, session_id, cwd, cwd_norm, project_slug, mtime_ms, size_bytes, first_message_rowid, last_message_rowid)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          firstRowid,
          lastRowid,
        );
      markSemanticIncomplete(this.#db);
    })();
    return pending.length;
  }

  #deleteFile(path: string): void {
    // Each file's messages are inserted consecutively inside one transaction.
    // Rowid bounds let FTS5 seek directly instead of scanning its unindexed path column.
    this.#db.transaction(() => {
      const bounds = messageBoundsSchema.parse(
        this.#db
          .query("SELECT first_message_rowid, last_message_rowid FROM files WHERE path = ?")
          .get(path),
      );
      if (bounds === null) return;
      if (bounds.first_message_rowid !== null && bounds.last_message_rowid !== null) {
        this.#db.run("DELETE FROM messages_fts WHERE rowid BETWEEN ? AND ?", [
          bounds.first_message_rowid,
          bounds.last_message_rowid,
        ]);
      }
      this.#db.run("DELETE FROM files WHERE path = ?", [path]);
      deleteEmbeddings(this.#db, path);
      markSemanticIncomplete(this.#db);
    })();
  }

  #ensureSchema(intent: IndexOpenIntent): void {
    const metaObject = z
      .object({ type: z.enum(["table", "view"]) })
      .safeParse(this.#db.query("SELECT type FROM sqlite_master WHERE name = 'meta'").get());
    const metaExists = metaObject.success && metaObject.data.type === "table";
    const metaColumns = metaExists
      ? z
          .object({ name: z.string(), pk: z.number() })
          .array()
          .safeParse(this.#db.query("PRAGMA table_info(meta)").all())
      : undefined;
    const validMeta =
      metaExists &&
      metaColumns?.success === true &&
      metaColumns.data.some((column) => column.name === "key" && column.pk === 1) &&
      metaColumns.data.some((column) => column.name === "value");
    const searchTableCount = z
      .object({ count: z.number() })
      .parse(
        this.#db
          .query(
            "SELECT count(*) AS count FROM sqlite_master WHERE type IN ('table', 'view') AND name IN ('files', 'messages_fts', 'embeddings')",
          )
          .get(),
      ).count;

    if (!metaObject.success && searchTableCount === 0) {
      this.#db.exec("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
      this.#db.exec(schema);
      ensureSemanticSchema(this.#db);
      this.#db.run("INSERT INTO meta (key, value) VALUES (?, ?)", [
        schemaVersionKey,
        String(schemaVersion),
      ]);
      return;
    }
    if (!validMeta && intent === "search") {
      throw new IndexRebuildRequiredError(undefined);
    }

    if (!validMeta) {
      this.#pendingSchemaReset = {
        metaType: metaObject.success ? metaObject.data.type : undefined,
      };
      return;
    }

    const row = this.#db.query("SELECT value FROM meta WHERE key = ?").get(schemaVersionKey);
    const parsed = z.object({ value: z.string() }).safeParse(row);
    const current = parsed.success ? parsed.data.value : undefined;
    const rebuildRow = this.#db
      .query("SELECT value FROM meta WHERE key = ?")
      .get(schemaRebuildRequiredKey);
    const parsedRebuild = z.object({ value: z.string() }).safeParse(rebuildRow);
    const requiresRebuild = parsedRebuild.success || current !== String(schemaVersion);
    if (requiresRebuild) {
      const sourceVersion = parsedRebuild.success ? parsedRebuild.data.value : current;
      const numericVersion = parseSchemaVersion(sourceVersion);
      if (intent === "search") {
        throw new IndexRebuildRequiredError(numericVersion);
      }
      this.#pendingSchemaReset = { sourceVersion };
      return;
    }
    if (intent === "build") {
      this.#db.exec(schema);
      ensureSemanticSchema(this.#db);
    }
  }

  #prepareSchemaReset(): void {
    const pending = this.#pendingSchemaReset;
    if (pending === undefined) return;
    if (pending.metaType === "view") {
      this.#db.exec("DROP VIEW meta");
    } else if (pending.metaType === "table") {
      this.#db.exec("DROP TABLE meta");
    }
    this.#db.exec("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
    this.#db.run("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", [
      schemaRebuildRequiredKey,
      pending.sourceVersion ?? "unknown",
    ]);
    this.#dropSearchTables();
    this.#db.exec(schema);
    ensureSemanticSchema(this.#db);
    this.#schemaReset = {
      fromVersion: parseSchemaVersion(pending.sourceVersion),
      toVersion: schemaVersion,
    };
    this.#pendingSchemaReset = undefined;
  }

  #completeSchemaReset(): SchemaReset | undefined {
    const reset = this.#schemaReset;
    if (reset === undefined) return undefined;
    this.#db.transaction(() => {
      this.#db.run("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", [
        schemaVersionKey,
        String(schemaVersion),
      ]);
      this.#db.run("DELETE FROM meta WHERE key = ?", [schemaRebuildRequiredKey]);
    })();
    this.#schemaReset = undefined;
    return reset;
  }

  #dropSearchTables(): void {
    this.#db.exec("DROP TABLE IF EXISTS messages_fts");
    this.#db.exec("DROP TABLE IF EXISTS files");
    this.#db.exec("DROP TABLE IF EXISTS embeddings");
    markSemanticIncomplete(this.#db);
  }
}

function parseSchemaVersion(value: string | undefined): number | undefined {
  if (value === undefined || !/^\d+$/.test(value)) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
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
  options.signal?.throwIfAborted();
  const dbPath = await ensureIndexDir();
  const index = TranscriptIndex.openForBuild(dbPath);
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
  const index = TranscriptIndex.open();
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

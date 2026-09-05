import type { AdapterRegistry, TranscriptAdapter } from "@transcripts-mcp/core";

import type { BuildIndexOptions, SearchHit, SearchQuery } from "./types.ts";

import { Database } from "bun:sqlite";
import { mkdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { z } from "zod";

import { readJsonlLines } from "@transcripts-mcp/core";

import {
  deleteEmbeddings,
  embedCorpus,
  embedQuery,
  ensureSemanticSchema,
  fuseHits,
  hasEmbeddings,
  loadSqliteVec,
  searchVectors,
} from "./semantic.ts";

const schema = `
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS files (
  path TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  session_id TEXT NOT NULL,
  cwd TEXT,
  mtime_ms INTEGER NOT NULL,
  size_bytes INTEGER NOT NULL
);
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  text,
  provider UNINDEXED,
  role UNINDEXED,
  cwd UNINDEXED,
  session_id UNINDEXED,
  path UNINDEXED,
  line_number UNINDEXED,
  timestamp UNINDEXED,
  tokenize = 'porter'
);
`;

const fileRowSchema = z.object({
  path: z.string(),
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

export class TranscriptIndex {
  readonly #db: Database;
  #sqliteVecLoaded: boolean | undefined;

  constructor(dbPath = defaultIndexPath()) {
    this.#db = new Database(dbPath, { create: true });
    this.#db.exec(schema);
    ensureSemanticSchema(this.#db);
  }

  close(): void {
    this.#db.close();
  }

  semanticAvailable(): boolean {
    return hasEmbeddings(this.#db);
  }

  async build(
    registry: AdapterRegistry,
    options: BuildIndexOptions | boolean = {},
  ): Promise<BuildIndexResult> {
    const resolved = resolveBuildOptions(options);
    if (resolved.full) this.#reset();

    const previous = new Map<string, { mtimeMs: number; sizeBytes: number }>();
    for (const row of this.#db.query("SELECT path, mtime_ms, size_bytes FROM files").all()) {
      const parsed = fileRowSchema.safeParse(row);
      if (!parsed.success) continue;
      previous.set(parsed.data.path, {
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
      for await (const summary of adapter.listSessions({})) {
        seen.add(summary.path);
        const info = await stat(summary.path);
        const prior = previous.get(summary.path);
        if (
          !resolved.full &&
          prior !== undefined &&
          prior.mtimeMs === info.mtimeMs &&
          prior.sizeBytes === info.size
        ) {
          skipped += 1;
          continue;
        }
        messages += await this.#indexFile(
          adapter,
          summary.path,
          summary.cwd,
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

  search(query: SearchQuery): SearchHit[] {
    return this.#searchFts(query, query.limit ?? 20);
  }

  async searchHybrid(query: SearchQuery): Promise<SearchHit[]> {
    const limit = query.limit ?? 20;
    const ftsHits = this.#searchFts(query, limit);
    if (!this.semanticAvailable()) return ftsHits;
    const embedding = await embedQuery(query.query);
    if (embedding === undefined) return ftsHits;
    const useSqliteVec = await this.#ensureSqliteVec();
    return fuseHits(ftsHits, searchVectors(this.#db, embedding, query, limit, useSqliteVec), limit);
  }

  async #ensureSqliteVec(): Promise<boolean> {
    if (this.#sqliteVecLoaded !== undefined) return this.#sqliteVecLoaded;
    this.#sqliteVecLoaded = await loadSqliteVec(this.#db);
    return this.#sqliteVecLoaded;
  }

  #searchFts(query: SearchQuery, limit: number): SearchHit[] {
    const filters = ["messages_fts MATCH ?"];
    const params: Array<string | number> = [escapeFtsQuery(query.query)];
    if (query.provider !== undefined) {
      filters.push("provider = ?");
      params.push(query.provider);
    }
    if (query.role !== undefined) {
      filters.push("role = ?");
      params.push(query.role);
    }
    if (query.cwd !== undefined) {
      filters.push("cwd LIKE ?");
      params.push(`%${query.cwd}%`);
    }
    if (query.since !== undefined) {
      filters.push("(timestamp IS NULL OR timestamp >= ?)");
      params.push(query.since);
    }
    if (query.until !== undefined) {
      filters.push("(timestamp IS NULL OR timestamp <= ?)");
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
    path: string,
    cwd: string | undefined,
    mtimeMs: number,
    sizeBytes: number,
  ): Promise<number> {
    this.#deleteFile(path);
    const sessionId = adapter.sessionIdFromPath(path);
    const insert = this.#db.prepare(
      `INSERT INTO messages_fts (text, provider, role, cwd, session_id, path, line_number, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    let lineNumber = 0;
    let count = 0;
    for await (const text of readJsonlLines(path)) {
      lineNumber += 1;
      if (text.trim().length === 0) continue;
      const message = adapter.parseRawLine(text);
      if (message === null) continue;
      insert.run(
        message.text,
        adapter.id,
        message.role,
        cwd ?? null,
        sessionId,
        path,
        lineNumber,
        message.timestamp?.toISOString() ?? null,
      );
      count += 1;
    }
    this.#db
      .prepare(
        `INSERT INTO files (path, provider, session_id, cwd, mtime_ms, size_bytes)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(path, adapter.id, sessionId, cwd ?? null, mtimeMs, sizeBytes);
    return count;
  }

  #deleteFile(path: string): void {
    this.#db.run("DELETE FROM messages_fts WHERE path = ?", [path]);
    this.#db.run("DELETE FROM files WHERE path = ?", [path]);
    deleteEmbeddings(this.#db, path);
  }

  #reset(): void {
    this.#db.exec("DELETE FROM messages_fts");
    this.#db.exec("DELETE FROM files");
    this.#db.exec("DELETE FROM embeddings");
  }
}

export function defaultIndexPath(): string {
  return process.env.TRANSCRIPTS_MCP_INDEX ?? join(homedir(), ".transcripts-mcp", "index.db");
}

export async function ensureIndexDir(dbPath = defaultIndexPath()): Promise<string> {
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

export function searchFts(query: SearchQuery): SearchHit[] {
  const index = new TranscriptIndex();
  try {
    return index.search(query);
  } finally {
    index.close();
  }
}

export async function searchTranscripts(
  registry: AdapterRegistry,
  query: SearchQuery,
): Promise<SearchHit[]> {
  void registry;
  const index = new TranscriptIndex();
  try {
    if (query.mode === "hybrid") return await index.searchHybrid(query);
    return index.search(query);
  } finally {
    index.close();
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

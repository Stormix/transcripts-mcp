import type { Database } from "bun:sqlite";

import type { SearchHit, SearchQuery } from "./types.ts";

import { z } from "zod";

import { matchesCwdFilter } from "@transcripts-mcp/core";

import { embeddingDimensions } from "./constants.ts";
import { reciprocalRankFusion } from "./fusion.ts";
import { normalizeSearchQueryDates } from "./utils.ts";

const semanticStateKey = "semantic_state";
const semanticIncomplete = "incomplete";
const semanticComplete = "complete";

const embeddingRowSchema = z.object({
  path: z.string(),
  line_number: z.number(),
  provider: z.string(),
  session_id: z.string(),
  role: z.string(),
  text: z.string(),
  cwd: z.string().nullable(),
  cwd_norm: z.string().nullable(),
  project_slug: z.string().nullable(),
  timestamp: z.string().nullable(),
  effective_timestamp: z.string(),
  vector: z.instanceof(Uint8Array),
});

const pendingRowSchema = z.object({
  path: z.string(),
  line_number: z.number(),
  provider: z.string(),
  session_id: z.string(),
  role: z.string(),
  text: z.string(),
  cwd: z.string().nullable(),
  cwd_norm: z.string().nullable(),
  project_slug: z.string().nullable(),
  timestamp: z.string().nullable(),
  effective_timestamp: z.string(),
});

const vectorTable = `
CREATE TABLE IF NOT EXISTS embeddings (
  path TEXT NOT NULL,
  line_number INTEGER NOT NULL,
  provider TEXT NOT NULL,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  text TEXT NOT NULL,
  cwd TEXT,
  cwd_norm TEXT,
  project_slug TEXT,
  timestamp TEXT,
  effective_timestamp TEXT NOT NULL,
  vector BLOB NOT NULL,
  PRIMARY KEY (path, line_number)
);
`;

interface SemanticEngine {
  embedText(text: string): Promise<Float32Array | undefined>;
  tryLoadSqliteVec(db: Database): boolean;
}

let engine: SemanticEngine | undefined;
let engineFailed = false;

export function ensureSemanticSchema(db: Database): void {
  db.exec("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  db.exec(vectorTable);
}

export function semanticIndexComplete(db: Database): boolean {
  const state = db.query("SELECT value FROM meta WHERE key = ?").get(semanticStateKey);
  const parsed = z.object({ value: z.string() }).safeParse(state);
  return parsed.success && parsed.data.value === semanticComplete && corpusIsComplete(db);
}

export function markSemanticIncomplete(db: Database): void {
  setSemanticState(db, semanticIncomplete);
}

export function deleteEmbeddings(db: Database, path: string): void {
  db.run("DELETE FROM embeddings WHERE path = ?", [path]);
}

export async function embedQuery(query: string): Promise<Float32Array | undefined> {
  const loaded = await loadEngine();
  if (loaded === undefined) return undefined;
  return loaded.embedText(query);
}

export async function loadSqliteVec(db: Database): Promise<boolean> {
  const loaded = await loadEngine();
  if (loaded === undefined) return false;
  return loaded.tryLoadSqliteVec(db);
}

export function searchVectors(
  db: Database,
  queryVector: Float32Array,
  query: SearchQuery,
  limit: number,
  useSqliteVec: boolean,
): SearchHit[] {
  if (limit < 1) return [];
  const normalizedQuery = normalizeSearchQueryDates(query);
  if (useSqliteVec) {
    const vecHits = searchWithSqliteVec(db, queryVector, normalizedQuery, limit);
    if (vecHits !== undefined) return vecHits;
  }
  return searchWithCosine(db, queryVector, normalizedQuery, limit);
}

export function fuseHits(
  ftsHits: SearchHit[],
  vectorHits: SearchHit[],
  limit: number,
): SearchHit[] {
  const fused = reciprocalRankFusion([
    ftsHits.map((hit, index) => ({ id: `${hit.path}:${hit.lineNumber}`, rank: index + 1 })),
    vectorHits.map((hit, index) => ({ id: `${hit.path}:${hit.lineNumber}`, rank: index + 1 })),
  ]);
  const byId = new Map<string, SearchHit>();
  for (const hit of [...ftsHits, ...vectorHits]) {
    byId.set(`${hit.path}:${hit.lineNumber}`, hit);
  }
  const results: SearchHit[] = [];
  for (const item of fused) {
    const hit = byId.get(item.id);
    if (hit === undefined) continue;
    results.push({ ...hit, score: item.score });
    if (results.length >= limit) break;
  }
  return results;
}

type EmbedText = (text: string) => Promise<Float32Array | undefined>;

export async function embedCorpus(db: Database, embedText?: EmbedText): Promise<boolean> {
  if (corpusIsComplete(db)) {
    setSemanticState(db, semanticComplete);
    return true;
  }
  markSemanticIncomplete(db);
  const loaded = embedText === undefined ? await loadEngine() : undefined;
  const embed = embedText ?? loaded?.embedText;
  if (embed === undefined) return false;

  const pending = db
    .query(
      `SELECT path, line_number, provider, session_id, role, text, cwd, cwd_norm, project_slug, timestamp, effective_timestamp
       FROM messages_fts
       WHERE NOT EXISTS (
         SELECT 1 FROM embeddings
         WHERE embeddings.path = messages_fts.path
           AND embeddings.line_number = messages_fts.line_number
       )`,
    )
    .all();

  const insert = db.prepare(
    `INSERT INTO embeddings (path, line_number, provider, session_id, role, text, cwd, cwd_norm, project_slug, timestamp, effective_timestamp, vector)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  for (const row of pending) {
    const parsed = pendingRowSchema.safeParse(row);
    if (!parsed.success) return false;
    let vector: Float32Array | undefined;
    try {
      vector = await embed(parsed.data.text);
    } catch (error) {
      console.error("semantic embedding failed", error);
      return false;
    }
    if (
      vector === undefined ||
      vector.length !== embeddingDimensions ||
      vector.some((value) => !Number.isFinite(value))
    ) {
      return false;
    }
    try {
      insert.run(
        parsed.data.path,
        parsed.data.line_number,
        parsed.data.provider,
        parsed.data.session_id,
        parsed.data.role,
        parsed.data.text,
        parsed.data.cwd,
        parsed.data.cwd_norm,
        parsed.data.project_slug,
        parsed.data.timestamp,
        parsed.data.effective_timestamp,
        new Uint8Array(vector.buffer, vector.byteOffset, vector.byteLength),
      );
    } catch (error) {
      console.error("semantic embedding insert failed", error);
      return false;
    }
  }

  if (!corpusIsComplete(db)) return false;
  setSemanticState(db, semanticComplete);
  return true;
}

function setSemanticState(db: Database, state: string): void {
  db.run("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", [semanticStateKey, state]);
}

function corpusIsComplete(db: Database): boolean {
  const counts = db
    .query(
      `SELECT
         (SELECT count(*) FROM messages_fts) AS messages,
         (SELECT count(*) FROM embeddings) AS embeddings`,
    )
    .get();
  const parsedCounts = z.object({ messages: z.number(), embeddings: z.number() }).safeParse(counts);
  if (!parsedCounts.success || parsedCounts.data.messages < 1) return false;
  if (parsedCounts.data.messages !== parsedCounts.data.embeddings) return false;
  const missing = db
    .query(
      `SELECT 1
       FROM messages_fts
       LEFT JOIN embeddings USING (path, line_number)
       WHERE embeddings.path IS NULL
          OR embeddings.provider != messages_fts.provider
          OR embeddings.session_id != messages_fts.session_id
          OR embeddings.role != messages_fts.role
          OR embeddings.text != messages_fts.text
          OR embeddings.cwd IS NOT messages_fts.cwd
          OR embeddings.cwd_norm IS NOT messages_fts.cwd_norm
          OR embeddings.project_slug IS NOT messages_fts.project_slug
          OR embeddings.timestamp IS NOT messages_fts.timestamp
          OR embeddings.effective_timestamp != messages_fts.effective_timestamp
       LIMIT 1`,
    )
    .get();
  return missing === null || missing === undefined;
}

async function loadEngine(): Promise<SemanticEngine | undefined> {
  if (engineFailed) return undefined;
  if (engine !== undefined) return engine;
  try {
    engine = await import("./semantic-engine.ts");
    return engine;
  } catch (error) {
    engineFailed = true;
    console.error("semantic engine unavailable", error);
    return undefined;
  }
}

function searchWithCosine(
  db: Database,
  queryVector: Float32Array,
  query: SearchQuery,
  limit: number,
): SearchHit[] {
  const scored: SearchHit[] = [];
  for (const row of db.query("SELECT * FROM embeddings").all()) {
    const parsed = embeddingRowSchema.safeParse(row);
    if (!parsed.success) continue;
    if (!matchesFilters(parsed.data, query)) continue;
    scored.push(
      toHit(parsed.data, cosineSimilarity(queryVector, float32FromBytes(parsed.data.vector))),
    );
  }
  scored.sort((left, right) => right.score - left.score);
  return scored.slice(0, limit);
}

function searchWithSqliteVec(
  db: Database,
  queryVector: Float32Array,
  query: SearchQuery,
  limit: number,
): SearchHit[] | undefined {
  try {
    const rows = db
      .query(
        `SELECT path, line_number, provider, session_id, role, text, cwd, cwd_norm, project_slug, timestamp, effective_timestamp, vector,
                vec_distance_cosine(vector, ?) AS distance
         FROM embeddings
         ORDER BY distance`,
      )
      .iterate(new Uint8Array(queryVector.buffer, queryVector.byteOffset, queryVector.byteLength));
    const hits: SearchHit[] = [];
    for (const row of rows) {
      const parsed = embeddingRowSchema.extend({ distance: z.number() }).safeParse(row);
      if (!parsed.success) continue;
      if (!matchesFilters(parsed.data, query)) continue;
      hits.push(toHit(parsed.data, 1 - parsed.data.distance));
      if (hits.length >= limit) break;
    }
    return hits;
  } catch (error) {
    console.error("sqlite-vec query failed; using cosine fallback", error);
    return undefined;
  }
}

function matchesFilters(
  row: {
    provider: string;
    role: string;
    cwd: string | null;
    cwd_norm: string | null;
    project_slug: string | null;
    effective_timestamp: string;
  },
  query: SearchQuery,
): boolean {
  if (query.provider !== undefined && row.provider !== query.provider) return false;
  if (query.role !== undefined && row.role !== query.role) return false;
  if (
    query.cwd !== undefined &&
    !matchesCwdFilter(
      query.cwd,
      row.cwd ?? row.cwd_norm ?? undefined,
      row.project_slug ?? undefined,
    )
  ) {
    return false;
  }
  if (query.since !== undefined && row.effective_timestamp < query.since) return false;
  if (query.until !== undefined && row.effective_timestamp > query.until) return false;
  return true;
}

function toHit(
  row: {
    provider: string;
    session_id: string;
    path: string;
    line_number: number;
    role: string;
    text: string;
    cwd: string | null;
    timestamp: string | null;
  },
  score: number,
): SearchHit {
  return {
    provider: row.provider,
    sessionId: row.session_id,
    path: row.path,
    lineNumber: row.line_number,
    role: row.role,
    text: row.text,
    cwd: row.cwd ?? undefined,
    timestamp: row.timestamp ?? undefined,
    score,
  };
}

function float32FromBytes(bytes: Uint8Array): Float32Array {
  return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
}

function cosineSimilarity(left: Float32Array, right: Float32Array): number {
  const n = Math.min(left.length, right.length);
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < n; index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    dot += a * b;
    leftNorm += a * a;
    rightNorm += b * b;
  }
  if (leftNorm === 0 || rightNorm === 0) return 0;
  return dot / Math.sqrt(leftNorm * rightNorm);
}

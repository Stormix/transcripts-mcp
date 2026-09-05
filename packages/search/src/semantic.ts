import type { Database } from "bun:sqlite";

import type { SearchHit, SearchQuery } from "./types.ts";

import { z } from "zod";

import { reciprocalRankFusion } from "./fusion.ts";

const embeddingRowSchema = z.object({
  path: z.string(),
  line_number: z.number(),
  provider: z.string(),
  session_id: z.string(),
  role: z.string(),
  text: z.string(),
  cwd: z.string().nullable(),
  timestamp: z.string().nullable(),
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
  timestamp: z.string().nullable(),
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
  timestamp TEXT,
  vector BLOB NOT NULL,
  PRIMARY KEY (path, line_number)
);
`;

interface SemanticEngine {
  embedText(text: string): Promise<Float32Array | undefined>;
  tryLoadSqliteVec(db: Database): boolean;
}

let ready = false;
let sqliteVecReady = false;
let engine: SemanticEngine | undefined;
let engineFailed = false;

export function isSemanticReady(): boolean {
  return ready;
}

export function ensureSemanticSchema(db: Database): void {
  db.exec(vectorTable);
}

export function deleteEmbeddings(db: Database, path: string): void {
  db.run("DELETE FROM embeddings WHERE path = ?", [path]);
}

export async function embedQuery(query: string): Promise<Float32Array | undefined> {
  const loaded = await loadEngine();
  if (loaded === undefined) return undefined;
  return loaded.embedText(query);
}

export function searchVectors(
  db: Database,
  queryVector: Float32Array,
  query: SearchQuery,
  limit: number,
): SearchHit[] {
  if (sqliteVecReady) {
    const vecHits = searchWithSqliteVec(db, queryVector, query, limit);
    if (vecHits !== undefined) return vecHits;
  }
  return searchWithCosine(db, queryVector, query, limit);
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

export async function embedCorpus(db: Database): Promise<boolean> {
  const loaded = await loadEngine();
  if (loaded === undefined) {
    ready = false;
    return false;
  }
  sqliteVecReady = loaded.tryLoadSqliteVec(db);

  const pending = db
    .query(
      `SELECT path, line_number, provider, session_id, role, text, cwd, timestamp
       FROM messages_fts
       WHERE NOT EXISTS (
         SELECT 1 FROM embeddings
         WHERE embeddings.path = messages_fts.path
           AND embeddings.line_number = messages_fts.line_number
       )`,
    )
    .all();

  const insert = db.prepare(
    `INSERT INTO embeddings (path, line_number, provider, session_id, role, text, cwd, timestamp, vector)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  let embedded = 0;
  for (const row of pending) {
    const parsed = pendingRowSchema.safeParse(row);
    if (!parsed.success) continue;
    const vector = await loaded.embedText(parsed.data.text);
    if (vector === undefined) {
      ready = embedded > 0;
      return ready;
    }
    insert.run(
      parsed.data.path,
      parsed.data.line_number,
      parsed.data.provider,
      parsed.data.session_id,
      parsed.data.role,
      parsed.data.text,
      parsed.data.cwd,
      parsed.data.timestamp,
      new Uint8Array(vector.buffer, vector.byteOffset, vector.byteLength),
    );
    embedded += 1;
  }

  const existing = db.query("SELECT 1 FROM embeddings LIMIT 1").get();
  ready = existing !== null && existing !== undefined;
  return ready;
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
        `SELECT path, line_number, provider, session_id, role, text, cwd, timestamp, vector,
                vec_distance_cosine(vector, ?) AS distance
         FROM embeddings
         ORDER BY distance
         LIMIT ?`,
      )
      .all(
        new Uint8Array(queryVector.buffer, queryVector.byteOffset, queryVector.byteLength),
        limit * 4,
      );
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
    sqliteVecReady = false;
    return undefined;
  }
}

function matchesFilters(
  row: {
    provider: string;
    role: string;
    cwd: string | null;
    timestamp: string | null;
  },
  query: SearchQuery,
): boolean {
  if (query.provider !== undefined && row.provider !== query.provider) return false;
  if (query.role !== undefined && row.role !== query.role) return false;
  if (query.cwd !== undefined && (row.cwd ?? "").indexOf(query.cwd) === -1) return false;
  if (row.timestamp === null) return true;
  const stamp = Date.parse(row.timestamp);
  if (Number.isNaN(stamp)) return true;
  if (query.since !== undefined && stamp < Date.parse(query.since)) return false;
  if (query.until !== undefined && stamp > Date.parse(query.until)) return false;
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

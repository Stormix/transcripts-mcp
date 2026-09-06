import type { Database } from "bun:sqlite";

import type { SearchHit, SearchQuery, SearchScope } from "./types.ts";

import { z } from "zod";

import { matchesCwdFilter, normalizeCwd, slugifyCwd } from "@transcripts-mcp/core";

import { embeddingDimensions } from "./constants.ts";
import { reciprocalRankFusion } from "./fusion.ts";
import { normalizeSearchQueryDates } from "./utils.ts";
import { VectorTopK } from "./vector-top-k.ts";

const semanticStateKey = "semantic_state";
const semanticIncomplete = "incomplete";
const semanticComplete = "complete";
export const semanticCorpusPageSize = 128;

const embeddingRowSchema = z.object({
  path: z.string(),
  line_number: z.number(),
  provider: z.string(),
  source_root: z.string(),
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
  source_root: z.string(),
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
  source_root TEXT NOT NULL,
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
CREATE INDEX IF NOT EXISTS embeddings_scope_idx ON embeddings(provider, source_root);
`;

interface SemanticEngine {
  embedText(text: string): Promise<Float32Array | undefined>;
  embedTexts(texts: readonly string[]): Promise<readonly (Float32Array | undefined)[]>;
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
  scopes: SearchScope[],
): SearchHit[] {
  if (limit < 1 || scopes.length === 0) return [];
  const normalizedQuery = normalizeSearchQueryDates(query);
  if (useSqliteVec) {
    const vecHits = searchWithSqliteVec(db, queryVector, normalizedQuery, limit, scopes);
    if (vecHits !== undefined) return vecHits;
  }
  return searchWithCosine(db, queryVector, normalizedQuery, limit, scopes);
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
type CorpusEmbedder =
  | EmbedText
  | {
      embedTexts(texts: readonly string[]): Promise<readonly (Float32Array | undefined)[]>;
    };

interface EmbeddedRow {
  row: z.infer<typeof pendingRowSchema>;
  vector: Uint8Array;
}

export async function embedCorpus(
  db: Database,
  embedder?: CorpusEmbedder,
  options: { signal?: AbortSignal; onProgress?: (messages: number) => Promise<void> } = {},
): Promise<boolean> {
  options.signal?.throwIfAborted();
  await options.onProgress?.(0);
  options.signal?.throwIfAborted();
  if (corpusIsComplete(db)) {
    setSemanticState(db, semanticComplete);
    return true;
  }
  markSemanticIncomplete(db);
  const loaded = embedder === undefined ? await loadEngine() : undefined;
  options.signal?.throwIfAborted();
  const selectedEmbedder = embedder ?? loaded;
  if (selectedEmbedder === undefined) return false;

  const selectPage = db.query(
    `SELECT path, line_number, provider, source_root, session_id, role, text, cwd, cwd_norm, project_slug, timestamp, effective_timestamp
     FROM messages_fts
     WHERE NOT EXISTS (
       SELECT 1 FROM embeddings
       WHERE embeddings.path = messages_fts.path
         AND embeddings.line_number = messages_fts.line_number
     )
       AND (path > ? OR (path = ? AND line_number > ?))
     ORDER BY path, line_number
     LIMIT ?`,
  );
  const insert = db.query(
    `INSERT INTO embeddings (path, line_number, provider, source_root, session_id, role, text, cwd, cwd_norm, project_slug, timestamp, effective_timestamp, vector)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  let afterPath = "";
  let afterLineNumber = 0;
  let embeddedCount = 0;
  for (;;) {
    options.signal?.throwIfAborted();
    const parsedPage = pendingRowSchema
      .array()
      .safeParse(selectPage.all(afterPath, afterPath, afterLineNumber, semanticCorpusPageSize));
    if (!parsedPage.success) return false;
    if (parsedPage.data.length === 0) break;

    let vectors: readonly (Float32Array | undefined)[];
    try {
      vectors = await embedPage(
        selectedEmbedder,
        parsedPage.data.map((row) => row.text),
      );
    } catch (error) {
      options.signal?.throwIfAborted();
      console.error("semantic embedding failed", error);
      return false;
    }
    options.signal?.throwIfAborted();
    if (vectors.length !== parsedPage.data.length) return false;

    const embeddedRows: EmbeddedRow[] = [];
    for (const [index, row] of parsedPage.data.entries()) {
      const vector = vectors[index];
      if (
        vector === undefined ||
        vector.length !== embeddingDimensions ||
        vector.some((value) => !Number.isFinite(value))
      ) {
        return false;
      }
      embeddedRows.push({
        row,
        vector: new Uint8Array(vector.buffer, vector.byteOffset, vector.byteLength),
      });
    }

    try {
      db.transaction(() => {
        for (const embedded of embeddedRows) {
          insert.run(
            embedded.row.path,
            embedded.row.line_number,
            embedded.row.provider,
            embedded.row.source_root,
            embedded.row.session_id,
            embedded.row.role,
            embedded.row.text,
            embedded.row.cwd,
            embedded.row.cwd_norm,
            embedded.row.project_slug,
            embedded.row.timestamp,
            embedded.row.effective_timestamp,
            embedded.vector,
          );
        }
      })();
    } catch (error) {
      console.error("semantic embedding insert failed", error);
      return false;
    }

    const last = parsedPage.data.at(-1);
    if (last === undefined) return false;
    afterPath = last.path;
    afterLineNumber = last.line_number;
    embeddedCount += embeddedRows.length;
    await options.onProgress?.(embeddedCount);
  }

  options.signal?.throwIfAborted();
  if (!corpusIsComplete(db)) return false;
  setSemanticState(db, semanticComplete);
  return true;
}

async function embedPage(
  embedder: CorpusEmbedder,
  texts: readonly string[],
): Promise<readonly (Float32Array | undefined)[]> {
  if (typeof embedder !== "function") return embedder.embedTexts(texts);
  const vectors: (Float32Array | undefined)[] = [];
  for (const text of texts) vectors.push(await embedder(text));
  return vectors;
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
          OR embeddings.source_root != messages_fts.source_root
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
  scopes: SearchScope[],
): SearchHit[] {
  const filter = buildVectorFilter(query, scopes);
  const topHits = new VectorTopK(limit);
  for (const row of db
    .query(
      `SELECT path, line_number, provider, source_root, session_id, role, text, cwd, cwd_norm, project_slug, timestamp, effective_timestamp, vector
       FROM embeddings
       WHERE ${filter.clause}`,
    )
    .iterate(...filter.params)) {
    const parsed = embeddingRowSchema.safeParse(row);
    if (!parsed.success) continue;
    if (
      query.cwd !== undefined &&
      !matchesCwdFilter(
        query.cwd,
        parsed.data.cwd ?? parsed.data.cwd_norm ?? undefined,
        parsed.data.project_slug ?? undefined,
      )
    ) {
      continue;
    }
    topHits.add(
      toHit(parsed.data, cosineSimilarity(queryVector, float32FromBytes(parsed.data.vector))),
    );
  }
  return topHits.toSorted();
}

function searchWithSqliteVec(
  db: Database,
  queryVector: Float32Array,
  query: SearchQuery,
  limit: number,
  scopes: SearchScope[],
): SearchHit[] | undefined {
  try {
    const filter = buildVectorFilter(query, scopes);
    const rows = db
      .query(
        `SELECT path, line_number, provider, source_root, session_id, role, text, cwd, cwd_norm, project_slug, timestamp, effective_timestamp, vector,
                vec_distance_cosine(vector, ?) AS distance
         FROM embeddings
         WHERE ${filter.clause}
         ORDER BY distance, path COLLATE BINARY, line_number
         LIMIT ?`,
      )
      .iterate(
        new Uint8Array(queryVector.buffer, queryVector.byteOffset, queryVector.byteLength),
        ...filter.params,
        limit,
      );
    const hits: SearchHit[] = [];
    for (const row of rows) {
      const parsed = embeddingRowSchema.extend({ distance: z.number() }).safeParse(row);
      if (!parsed.success) continue;
      hits.push(toHit(parsed.data, 1 - parsed.data.distance));
    }
    return hits;
  } catch (error) {
    console.error("sqlite-vec query failed; using cosine fallback", error);
    return undefined;
  }
}

interface VectorFilter {
  clause: string;
  params: string[];
}

function buildVectorFilter(query: SearchQuery, scopes: SearchScope[]): VectorFilter {
  const params: string[] = [];
  const scopeClause = scopes.map(() => "(provider = ? AND source_root = ?)").join(" OR ");
  for (const scope of scopes) params.push(scope.provider, scope.root);
  const clauses = [`(${scopeClause})`];
  if (query.provider !== undefined) {
    clauses.push("provider = ?");
    params.push(query.provider);
  }
  if (query.role !== undefined) {
    clauses.push("role = ?");
    params.push(query.role);
  }
  if (query.cwd !== undefined) {
    clauses.push("(cwd_norm = ? OR project_slug = ?)");
    params.push(normalizeCwd(query.cwd), slugifyCwd(query.cwd));
  }
  if (query.since !== undefined) {
    clauses.push("effective_timestamp >= ?");
    params.push(query.since);
  }
  if (query.until !== undefined) {
    clauses.push("effective_timestamp <= ?");
    params.push(query.until);
  }
  return { clause: clauses.join(" AND "), params };
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

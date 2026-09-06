import { Database } from "bun:sqlite";

import { z } from "zod";

import {
  embedCorpus,
  ensureSemanticSchema,
  semanticCorpusPageSize,
  semanticIndexComplete,
} from "../semantic.ts";

const rowCount = 300;
const countSchema = z.object({ count: z.number() });

const successDb = createCorpus(rowCount);
const embeddedTexts: string[] = [];
const batchSizes: number[] = [];
const success = await embedCorpus(successDb, {
  embedTexts: async (texts) => {
    batchSizes.push(texts.length);
    embeddedTexts.push(...texts);
    return texts.map(() => new Float32Array(384));
  },
});
const identityMismatches = countIdentityMismatches(successDb);
const successEmbeddings = countEmbeddings(successDb);
successDb.close();

const retryDb = createCorpus(rowCount);
let batchAttempts = 0;
const failed = await embedCorpus(retryDb, {
  embedTexts: async (texts) => {
    batchAttempts += 1;
    if (batchAttempts === 2) throw new Error("injected page failure");
    return texts.map(() => new Float32Array(384));
  },
});
const committedBeforeRetry = countEmbeddings(retryDb);
const incompleteBeforeRetry = !semanticIndexComplete(retryDb);
const retried = await embedCorpus(retryDb, async () => new Float32Array(384));
const retryEmbeddings = countEmbeddings(retryDb);
const completeAfterRetry = semanticIndexComplete(retryDb);
retryDb.close();

console.info(
  `SEMANTIC_BATCH:${JSON.stringify({
    success,
    embeddedExactlyOnce:
      embeddedTexts.length === rowCount && new Set(embeddedTexts).size === rowCount,
    batchSizes,
    pageSize: semanticCorpusPageSize,
    rowCount,
    identityMismatches,
    successEmbeddings,
    failed,
    committedBeforeRetry,
    incompleteBeforeRetry,
    retried,
    retryEmbeddings,
    completeAfterRetry,
  })}`,
);

function createCorpus(count: number): Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE messages_fts (
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
      PRIMARY KEY (path, line_number)
    )
  `);
  ensureSemanticSchema(db);
  const insert = db.prepare(
    `INSERT INTO messages_fts
       (path, line_number, provider, source_root, session_id, role, text, effective_timestamp)
     VALUES ('session.jsonl', ?, 'fixture', 'fixture-root', 'session', 'user', ?, '2026-09-06T00:00:00.000Z')`,
  );
  db.transaction(() => {
    for (let lineNumber = 1; lineNumber <= count; lineNumber += 1) {
      insert.run(lineNumber, `message-${lineNumber}`);
    }
  })();
  return db;
}

function countEmbeddings(db: Database): number {
  return countSchema.parse(db.query("SELECT count(*) AS count FROM embeddings").get()).count;
}

function countIdentityMismatches(db: Database): number {
  return countSchema.parse(
    db
      .query(
        `SELECT count(*) AS count
         FROM messages_fts
         JOIN embeddings USING (path, line_number)
         WHERE messages_fts.text != embeddings.text
            OR messages_fts.session_id != embeddings.session_id`,
      )
      .get(),
  ).count;
}

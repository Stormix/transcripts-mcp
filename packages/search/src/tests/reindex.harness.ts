import { Database } from "bun:sqlite";
import assert from "node:assert/strict";
import { join } from "node:path";

import { createRegistry, resolveTranscriptRoot } from "@transcripts-mcp/core";

import { TranscriptIndex } from "../fts.ts";
import { embedCorpus } from "../semantic.ts";
import {
  createFixtureAdapter,
  createFixtureRoot,
  messageLine,
  removeFixtureRoot,
  writeSession,
} from "./helpers.ts";

const scenario = process.argv[2];
const full = scenario === "full-parse" || scenario === "full-write";
const root = await createFixtureRoot();
const dbPath = join(root, "index.db");
const legacy = new Database(dbPath);
legacy.exec(`
  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  INSERT INTO meta (key, value) VALUES ('schema_version', '3');
  CREATE TABLE files (path TEXT PRIMARY KEY);
  CREATE VIRTUAL TABLE messages_fts USING fts5(text);
  CREATE TABLE embeddings (path TEXT PRIMARY KEY);
`);
legacy.close();
const index = new TranscriptIndex(dbPath);
const db = new Database(dbPath);
try {
  for (const table of ["files", "messages_fts", "embeddings"]) {
    assert.ok(
      db.query(`SELECT name FROM pragma_table_info('${table}') WHERE name = 'source_root'`).get(),
      `${table} was not upgraded with source_root`,
    );
  }
  const adapter = createFixtureAdapter(root);
  const registry = createRegistry([adapter]);
  const scopes = [{ provider: adapter.id, root: await resolveTranscriptRoot(root) }];
  await writeSession(root, "one", [messageLine("user", "originalterm")]);
  await index.build(registry);
  assert.equal(await embedCorpus(db, async () => new Float32Array(384)), true);
  const originalFiles = db.query("SELECT * FROM files").all();
  await writeSession(root, "one", [
    messageLine("user", "replacementterm first"),
    messageLine("assistant", "replacementterm second"),
  ]);
  if (scenario === "parse" || scenario === "full-parse") {
    let lines = 0;
    const failing = {
      ...adapter,
      parseRawLine(text: string) {
        lines += 1;
        if (lines === 2) throw new Error("injected parse failure");
        return adapter.parseRawLine(text);
      },
    };
    await assert.rejects(
      index.build(createRegistry([failing]), { full }),
      /injected parse failure/,
    );
  } else {
    db.exec(
      "CREATE TRIGGER reject_file BEFORE INSERT ON files BEGIN SELECT RAISE(ABORT, 'injected write failure'); END",
    );
    await assert.rejects(index.build(registry, { full }), /injected write failure/);
    db.exec("DROP TRIGGER reject_file");
  }
  assert.equal(index.search({ query: "originalterm" }, scopes).length, 1);
  assert.equal(index.search({ query: "replacementterm" }, scopes).length, 0);
  assert.equal(index.semanticAvailable(), true);
  assert.deepEqual(db.query("SELECT * FROM files").all(), originalFiles);
  const retried = await index.build(registry, { full });
  assert.equal(retried.files, 1);
  assert.equal(retried.messages, 2);
  assert.equal(index.search({ query: "originalterm" }, scopes).length, 0);
  assert.equal(index.search({ query: "replacementterm" }, scopes).length, 2);
  assert.equal(index.semanticAvailable(), false);
  assert.equal((await index.build(registry)).skipped, 1);
  assert.equal((await index.build(registry, { full: true })).files, 1);
  assert.equal(index.search({ query: "replacementterm" }, scopes).length, 2);
  console.info("REINDEX_OK");
} finally {
  db.close();
  index.close();
  await removeFixtureRoot(root);
}

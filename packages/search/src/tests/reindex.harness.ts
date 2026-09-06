import { Database } from "bun:sqlite";
import assert from "node:assert/strict";
import { join } from "node:path";

import { createRegistry } from "@transcripts-mcp/core";

import { TranscriptIndex } from "../fts.ts";
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
const index = new TranscriptIndex(dbPath);
const db = new Database(dbPath);
try {
  const adapter = createFixtureAdapter(root);
  const registry = createRegistry([adapter]);
  const path = await writeSession(root, "one", [messageLine("user", "originalterm")]);
  await index.build(registry);
  db.run(
    "INSERT INTO embeddings (path,line_number,provider,session_id,role,text,vector) VALUES (?,1,'fixture','one','user','originalterm',?)",
    [path, new Uint8Array(new Float32Array([1, 0]).buffer)],
  );
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
  assert.equal(index.search({ query: "originalterm" }).length, 1);
  assert.equal(index.search({ query: "replacementterm" }).length, 0);
  assert.equal(index.semanticAvailable(), true);
  assert.deepEqual(db.query("SELECT * FROM files").all(), originalFiles);
  const retried = await index.build(registry, { full });
  assert.equal(retried.files, 1);
  assert.equal(retried.messages, 2);
  assert.equal(index.search({ query: "originalterm" }).length, 0);
  assert.equal(index.search({ query: "replacementterm" }).length, 2);
  assert.equal(index.semanticAvailable(), false);
  assert.equal((await index.build(registry)).skipped, 1);
  assert.equal((await index.build(registry, { full: true })).files, 1);
  assert.equal(index.search({ query: "replacementterm" }).length, 2);
  console.info("REINDEX_OK");
} finally {
  db.close();
  index.close();
  await removeFixtureRoot(root);
}

import { Database } from "bun:sqlite";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { join } from "node:path";

import { buildIndex, searchTranscripts } from "../fts.ts";
import { embedCorpus } from "../semantic.ts";
import {
  createFixtureRegistry,
  createFixtureRoot,
  messageLine,
  removeFixtureRoot,
  writeSession,
} from "./helpers.ts";

const root = await createFixtureRoot();
const dbPath = join(root, "index.db");
process.env.TRANSCRIPTS_MCP_INDEX = dbPath;
const registry = createFixtureRegistry(root);
const originalRun = Database.prototype.run;
let messageDeletes = 0;
Database.prototype.run = function (...args: Parameters<Database["run"]>) {
  if (args[0].startsWith("DELETE FROM messages_fts")) messageDeletes += 1;
  return originalRun.apply(this, args);
};

try {
  const alpha = await writeSession(root, "alpha", [messageLine("user", "alpha original")]);
  await writeSession(root, "beta", [messageLine("user", "beta retained")]);
  await assert.rejects(buildIndex(registry, { signal: AbortSignal.abort() }), /abort/i);
  const controller = new AbortController();
  await assert.rejects(
    buildIndex(registry, {
      signal: controller.signal,
      onProgress: async (progress) => {
        if (progress.files === 1) controller.abort();
      },
    }),
    /abort/i,
  );
  const db = new Database(dbPath);
  try {
    assert.deepEqual(db.query("SELECT count(*) AS files FROM files").get(), { files: 1 });
  } finally {
    db.close();
  }
  const resumed = await buildIndex(registry);
  assert.equal(resumed.files, 1);
  assert.equal(resumed.skipped, 1);
  assert.equal(messageDeletes, 0, "new files must not scan or delete existing messages");

  await writeSession(root, "alpha", [
    messageLine("user", "alpha replacement"),
    messageLine("assistant", "alpha extra"),
  ]);
  await buildIndex(registry);
  assert.equal(messageDeletes, 1);
  assert.equal((await searchTranscripts(registry, { query: "original" })).length, 0);
  assert.equal((await searchTranscripts(registry, { query: "replacement" })).length, 1);
  assert.equal((await searchTranscripts(registry, { query: "retained" })).length, 1);
  await writeSession(root, "alpha", []);
  await buildIndex(registry);
  assert.equal((await searchTranscripts(registry, { query: "alpha" })).length, 0);
  await rm(alpha);
  await buildIndex(registry);
  assert.equal(messageDeletes, 2, "removing an empty file must not scan messages");
  assert.equal((await searchTranscripts(registry, { query: "retained" })).length, 1);
  await buildIndex(registry, { full: true });
  assert.equal((await searchTranscripts(registry, { query: "retained" })).length, 1);

  await writeSession(
    root,
    "beta",
    Array.from({ length: 1000 }, () => messageLine("user", "cancelled text")),
  );
  const readingController = new AbortController();
  await assert.rejects(
    buildIndex(registry, {
      signal: readingController.signal,
      onProgress: async (progress) => {
        if (progress.messages >= 255) readingController.abort();
      },
    }),
    /abort/i,
  );
  assert.equal((await searchTranscripts(registry, { query: "retained" })).length, 1);
  assert.equal((await searchTranscripts(registry, { query: "cancelled" })).length, 0);
  await writeSession(root, "beta", [messageLine("user", "beta retained")]);

  const embeddingDb = new Database(dbPath);
  const embeddingController = new AbortController();
  try {
    await assert.rejects(
      embedCorpus(
        embeddingDb,
        async () => {
          embeddingController.abort();
          return new Float32Array(384);
        },
        { signal: embeddingController.signal },
      ),
      /abort/i,
    );
    assert.deepEqual(embeddingDb.query("SELECT count(*) AS count FROM embeddings").get(), {
      count: 0,
    });
  } finally {
    embeddingDb.close();
  }

  const legacy = new Database(dbPath);
  legacy.run("UPDATE meta SET value = '4' WHERE key = 'schema_version'");
  legacy.close();
  const migrationController = new AbortController();
  await assert.rejects(
    buildIndex(registry, {
      signal: migrationController.signal,
      onProgress: async (progress) => {
        if (progress.files === 1) migrationController.abort();
      },
    }),
    /abort/i,
  );
  await assert.rejects(searchTranscripts(registry, { query: "retained" }), /incompatible/);
  const retried = await buildIndex(registry);
  assert.deepEqual(retried.schemaReset, { fromVersion: 4, toVersion: 5 });
  assert.equal((await searchTranscripts(registry, { query: "retained" })).length, 1);
  console.info("BUILD_CONTROL_OK");
} finally {
  Database.prototype.run = originalRun;
  await removeFixtureRoot(root);
}

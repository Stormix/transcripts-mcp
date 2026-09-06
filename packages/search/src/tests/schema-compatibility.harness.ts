import { Database } from "bun:sqlite";
import assert from "node:assert/strict";
import { join } from "node:path";

import { z } from "zod";

import { createRegistry } from "@transcripts-mcp/core";

import { buildIndex, searchTranscripts, TranscriptIndex } from "../fts.ts";
import {
  createFixtureAdapter,
  createFixtureRegistry,
  createFixtureRoot,
  messageLine,
  removeFixtureRoot,
  writeSession,
} from "./helpers.ts";

const compatibilityErrorSchema = z.object({
  code: z.literal("INDEX_REBUILD_REQUIRED"),
  actualSchemaVersion: z.literal(3),
  expectedSchemaVersion: z.literal(5),
});
const countSchema = z.object({ count: z.number() });

const root = await createFixtureRoot();
const dbPath = join(root, "index.db");
process.env.TRANSCRIPTS_MCP_INDEX = dbPath;
seedLegacyIndex(dbPath);

try {
  const registry = createFixtureRegistry(root);
  await assert.rejects(
    searchTranscripts(registry, { query: "sentinel" }),
    (error) => compatibilityErrorSchema.safeParse(error).success,
  );

  const reopened = new Database(dbPath);
  try {
    for (const table of ["files", "messages_fts", "embeddings"]) {
      const count = z
        .object({ count: z.number() })
        .parse(reopened.query(`SELECT count(*) AS count FROM ${table}`).get()).count;
      assert.equal(count, 1, `${table} changed during search`);
    }
    const version = z
      .object({ value: z.string() })
      .parse(reopened.query("SELECT value FROM meta WHERE key = 'schema_version'").get()).value;
    assert.equal(version, "3");
  } finally {
    reopened.close();
  }

  const unopenedBuild = TranscriptIndex.openForBuild(dbPath);
  unopenedBuild.close();
  const stillLegacy = new Database(dbPath);
  try {
    assert.equal(
      countSchema.parse(stillLegacy.query("SELECT count(*) AS count FROM files").get()).count,
      1,
    );
    assert.equal(
      z
        .object({ value: z.string() })
        .parse(stillLegacy.query("SELECT value FROM meta WHERE key = 'schema_version'").get())
        .value,
      "3",
    );
  } finally {
    stillLegacy.close();
  }

  await writeSession(root, "replacement", [messageLine("user", "replacement message")]);
  const rebuilt = await buildIndex(registry);
  assert.deepEqual(rebuilt.schemaReset, { fromVersion: 3, toVersion: 5 });
  assert.equal((await searchTranscripts(registry, { query: "replacement" })).length, 1);

  const rebuiltDb = new Database(dbPath);
  try {
    assert.equal(
      rebuiltDb.query("SELECT value FROM meta WHERE key = 'schema_rebuild_required'").get(),
      null,
    );
  } finally {
    rebuiltDb.close();
  }
  console.info("SCHEMA_COMPATIBILITY_OK");
} finally {
  await removeFixtureRoot(root);
}

const freshRoot = await createFixtureRoot();
process.env.TRANSCRIPTS_MCP_INDEX = join(freshRoot, "index.db");
try {
  await writeSession(freshRoot, "fresh", [messageLine("user", "fresh message")]);
  const built = await buildIndex(createFixtureRegistry(freshRoot));
  assert.equal(built.schemaReset, undefined);
  console.info("FRESH_SCHEMA_OK");
} finally {
  await removeFixtureRoot(freshRoot);
}

const failedRoot = await createFixtureRoot();
const failedDbPath = join(failedRoot, "index.db");
process.env.TRANSCRIPTS_MCP_INDEX = failedDbPath;
seedLegacyIndex(failedDbPath);
try {
  await writeSession(failedRoot, "retry", [messageLine("user", "retry message")]);
  const adapter = createFixtureAdapter(failedRoot);
  const failingAdapter = {
    ...adapter,
    parseRawLine() {
      throw new Error("injected schema rebuild failure");
    },
  };
  await assert.rejects(
    buildIndex(createRegistry([failingAdapter])),
    /injected schema rebuild failure/,
  );

  const failedDb = new Database(failedDbPath);
  try {
    const marker = z
      .object({ value: z.string() })
      .parse(
        failedDb.query("SELECT value FROM meta WHERE key = 'schema_rebuild_required'").get(),
      ).value;
    assert.equal(marker, "3");
  } finally {
    failedDb.close();
  }

  await assert.rejects(
    searchTranscripts(createFixtureRegistry(failedRoot), { query: "retry" }),
    (error) => compatibilityErrorSchema.safeParse(error).success,
  );
  const retried = await buildIndex(createFixtureRegistry(failedRoot));
  assert.deepEqual(retried.schemaReset, { fromVersion: 3, toVersion: 5 });
  assert.equal(
    (await searchTranscripts(createFixtureRegistry(failedRoot), { query: "retry" })).length,
    1,
  );
  console.info("FAILED_REBUILD_RETRY_OK");
} finally {
  await removeFixtureRoot(failedRoot);
}

const unversionedRoot = await createFixtureRoot();
const unversionedDbPath = join(unversionedRoot, "index.db");
process.env.TRANSCRIPTS_MCP_INDEX = unversionedDbPath;
const unversioned = new Database(unversionedDbPath);
try {
  unversioned.exec(`
    CREATE TABLE files (path TEXT PRIMARY KEY);
    INSERT INTO files (path) VALUES ('unversioned-sentinel');
    CREATE VIRTUAL TABLE messages_fts USING fts5(text);
    INSERT INTO messages_fts (text) VALUES ('unversioned sentinel');
    CREATE TABLE embeddings (path TEXT PRIMARY KEY);
    INSERT INTO embeddings (path) VALUES ('unversioned-embedding');
  `);
} finally {
  unversioned.close();
}
try {
  await assert.rejects(
    searchTranscripts(createFixtureRegistry(unversionedRoot), { query: "sentinel" }),
    (error) => {
      return compatibilityErrorSchema
        .omit({ actualSchemaVersion: true })
        .extend({ actualSchemaVersion: z.undefined() })
        .safeParse(error).success;
    },
  );
  const preserved = new Database(unversionedDbPath);
  try {
    assert.equal(
      countSchema.parse(
        preserved.query("SELECT count(*) AS count FROM sqlite_master WHERE name = 'meta'").get(),
      ).count,
      0,
    );
    assert.equal(
      countSchema.parse(preserved.query("SELECT count(*) AS count FROM files").get()).count,
      1,
    );
  } finally {
    preserved.close();
  }
  console.info("UNVERSIONED_SCHEMA_OK");
} finally {
  await removeFixtureRoot(unversionedRoot);
}

function seedLegacyIndex(legacyDbPath: string): void {
  const legacy = new Database(legacyDbPath);
  try {
    legacy.exec(`
      CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      INSERT INTO meta (key, value) VALUES ('schema_version', '3');
      CREATE TABLE files (path TEXT PRIMARY KEY);
      INSERT INTO files (path) VALUES ('sentinel-file');
      CREATE VIRTUAL TABLE messages_fts USING fts5(text);
      INSERT INTO messages_fts (text) VALUES ('sentinel message');
      CREATE TABLE embeddings (path TEXT PRIMARY KEY);
      INSERT INTO embeddings (path) VALUES ('sentinel-embedding');
    `);
  } finally {
    legacy.close();
  }
}

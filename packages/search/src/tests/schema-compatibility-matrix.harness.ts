import { Database } from "bun:sqlite";
import assert from "node:assert/strict";
import { join } from "node:path";

import { z } from "zod";

import { buildIndex, searchTranscripts } from "../fts.ts";
import {
  createFixtureRegistry,
  createFixtureRoot,
  messageLine,
  removeFixtureRoot,
  writeSession,
} from "./helpers.ts";

const errorSchema = z.object({
  code: z.literal("INDEX_REBUILD_REQUIRED"),
  actualSchemaVersion: z.number().optional(),
  expectedSchemaVersion: z.literal(4),
});
const countSchema = z.object({ count: z.number() });

for (const version of [2, 999]) {
  const root = await createFixtureRoot();
  const dbPath = join(root, "index.db");
  process.env.TRANSCRIPTS_MCP_INDEX = dbPath;
  seedVersionedIndex(dbPath, version);
  try {
    await assert.rejects(
      searchTranscripts(createFixtureRegistry(root), { query: "sentinel" }),
      (error) => {
        const parsed = errorSchema.safeParse(error);
        return parsed.success && parsed.data.actualSchemaVersion === version;
      },
    );
    const preserved = new Database(dbPath);
    try {
      assert.equal(
        countSchema.parse(preserved.query("SELECT count(*) AS count FROM files").get()).count,
        1,
      );
    } finally {
      preserved.close();
    }
  } finally {
    await removeFixtureRoot(root);
  }
}

const malformedRoot = await createFixtureRoot();
const malformedDbPath = join(malformedRoot, "index.db");
process.env.TRANSCRIPTS_MCP_INDEX = malformedDbPath;
const malformed = new Database(malformedDbPath);
try {
  malformed.exec(`
    CREATE TABLE meta (broken TEXT);
    INSERT INTO meta (broken) VALUES ('sentinel-meta');
    CREATE TABLE files (path TEXT PRIMARY KEY);
    INSERT INTO files (path) VALUES ('sentinel-file');
    CREATE VIRTUAL TABLE messages_fts USING fts5(text);
    CREATE TABLE embeddings (path TEXT PRIMARY KEY);
  `);
} finally {
  malformed.close();
}
try {
  await assert.rejects(
    searchTranscripts(createFixtureRegistry(malformedRoot), { query: "sentinel" }),
    (error) => {
      const parsed = errorSchema.safeParse(error);
      return parsed.success && parsed.data.actualSchemaVersion === undefined;
    },
  );
  const preserved = new Database(malformedDbPath);
  try {
    assert.deepEqual(
      z
        .object({ name: z.string() })
        .array()
        .parse(preserved.query("PRAGMA table_info(meta)").all())
        .map((column) => column.name),
      ["broken"],
    );
  } finally {
    preserved.close();
  }
  await writeSession(malformedRoot, "replacement", [messageLine("user", "replacement")]);
  const rebuilt = await buildIndex(createFixtureRegistry(malformedRoot));
  assert.deepEqual(rebuilt.schemaReset, { fromVersion: undefined, toVersion: 4 });
  assert.equal(
    (await searchTranscripts(createFixtureRegistry(malformedRoot), { query: "replacement" }))
      .length,
    1,
  );
} finally {
  await removeFixtureRoot(malformedRoot);
}

console.info("SCHEMA_COMPATIBILITY_MATRIX_OK");

function seedVersionedIndex(dbPath: string, version: number): void {
  const db = new Database(dbPath);
  try {
    db.exec(`
      CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE files (path TEXT PRIMARY KEY);
      INSERT INTO files (path) VALUES ('sentinel-file');
      CREATE VIRTUAL TABLE messages_fts USING fts5(text);
      CREATE TABLE embeddings (path TEXT PRIMARY KEY);
    `);
    db.run("INSERT INTO meta (key, value) VALUES ('schema_version', ?)", [String(version)]);
  } finally {
    db.close();
  }
}

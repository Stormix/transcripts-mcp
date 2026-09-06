import { Database } from "bun:sqlite";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { z } from "zod";

import { createRegistry } from "@transcripts-mcp/core";

import { buildIndex, searchTranscripts } from "../fts.ts";
import {
  createFixtureAdapter,
  createFixtureRegistry,
  createFixtureRoot,
  messageLine,
  removeFixtureRoot,
  writeSession,
} from "./helpers.ts";

const childMode = process.argv[2];
const childRoot = process.argv[3];
const childDbPath = process.argv[4];

if (childMode === "terminate") {
  assert.ok(childRoot);
  assert.ok(childDbPath);
  process.env.TRANSCRIPTS_MCP_INDEX = childDbPath;
  const adapter = createFixtureAdapter(childRoot);
  await buildIndex(
    createRegistry([
      {
        ...adapter,
        parseRawLine() {
          process.exit(86);
        },
      },
    ]),
  );
} else {
  await verifySqliteWriteFailure();
  await verifyProcessTermination();
  console.info("SCHEMA_REBUILD_FAILURE_OK");
}

async function verifySqliteWriteFailure(): Promise<void> {
  const root = await createFixtureRoot();
  const dbPath = join(root, "index.db");
  process.env.TRANSCRIPTS_MCP_INDEX = dbPath;
  seedLegacyIndex(dbPath);
  try {
    await writeSession(root, "write-failure", [messageLine("user", "write failure retry")]);
    const adapter = createFixtureAdapter(root);
    let triggerCreated = false;
    const failingAdapter = {
      ...adapter,
      parseRawLine(text: string) {
        if (!triggerCreated) {
          const db = new Database(dbPath);
          try {
            db.exec(`
              CREATE TRIGGER reject_file_insert BEFORE INSERT ON files
              BEGIN SELECT RAISE(ABORT, 'injected schema rebuild write failure'); END;
            `);
          } finally {
            db.close();
          }
          triggerCreated = true;
        }
        return adapter.parseRawLine(text);
      },
    };
    await assert.rejects(
      buildIndex(createRegistry([failingAdapter])),
      /injected schema rebuild write failure/,
    );
    assertRebuildMarker(dbPath, "3");
    await assert.rejects(searchTranscripts(createFixtureRegistry(root), { query: "retry" }));

    const db = new Database(dbPath);
    try {
      db.exec("DROP TRIGGER reject_file_insert");
    } finally {
      db.close();
    }
    const retried = await buildIndex(createFixtureRegistry(root));
    assert.deepEqual(retried.schemaReset, { fromVersion: 3, toVersion: 4 });
  } finally {
    await removeFixtureRoot(root);
  }
}

async function verifyProcessTermination(): Promise<void> {
  const root = await createFixtureRoot();
  const dbPath = join(root, "index.db");
  process.env.TRANSCRIPTS_MCP_INDEX = dbPath;
  seedLegacyIndex(dbPath);
  try {
    await writeSession(root, "termination", [messageLine("user", "termination retry")]);
    const result = spawnSync("bun", ["--bun", import.meta.filename, "terminate", root, dbPath], {
      encoding: "utf8",
    });
    assert.equal(result.status, 86, result.stderr || result.stdout);
    assertRebuildMarker(dbPath, "3");
    await assert.rejects(searchTranscripts(createFixtureRegistry(root), { query: "termination" }));
    const retried = await buildIndex(createFixtureRegistry(root));
    assert.deepEqual(retried.schemaReset, { fromVersion: 3, toVersion: 4 });
    assert.equal(
      (await searchTranscripts(createFixtureRegistry(root), { query: "termination" })).length,
      1,
    );
  } finally {
    await removeFixtureRoot(root);
  }
}

function assertRebuildMarker(dbPath: string, expected: string): void {
  const db = new Database(dbPath);
  try {
    const marker = z
      .object({ value: z.string() })
      .parse(db.query("SELECT value FROM meta WHERE key = 'schema_rebuild_required'").get());
    assert.equal(marker.value, expected);
  } finally {
    db.close();
  }
}

function seedLegacyIndex(dbPath: string): void {
  const db = new Database(dbPath);
  try {
    db.exec(`
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
    db.close();
  }
}

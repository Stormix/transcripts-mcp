import { Database } from "bun:sqlite";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildIndex, TranscriptIndex } from "../fts.ts";
import {
  createFixtureRegistry,
  createFixtureRoot,
  messageLine,
  removeFixtureRoot,
  writeSession,
} from "./helpers.ts";

const root = await createFixtureRoot();
const indexDir = await mkdtemp(join(tmpdir(), "transcripts-semantic-"));
const emptyDir = await mkdtemp(join(tmpdir(), "transcripts-semantic-empty-"));
const dbPath = join(indexDir, "index.db");
process.env.TRANSCRIPTS_MCP_INDEX = dbPath;

try {
  await writeSession(root, "alpha", [
    messageLine("user", "unique-fts-term zebra about indexing"),
    messageLine("assistant", "acknowledged"),
  ]);

  const registry = createFixtureRegistry(root);
  const built = await buildIndex(registry, { full: true });
  if (built.messages <= 0 || built.semantic) {
    throw new Error("FTS index unexpectedly reported semantic readiness");
  }

  const seed = new Database(dbPath);
  try {
    seed.run(
      `INSERT INTO embeddings (path, line_number, provider, session_id, role, text, cwd, timestamp, effective_timestamp, vector)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        join(root, "sessions", "alpha.jsonl"),
        1,
        "fixture",
        "alpha",
        "user",
        "unique-fts-term zebra about indexing",
        null,
        null,
        "2026-09-06T00:00:00.000Z",
        new Uint8Array(16),
      ],
    );
  } finally {
    seed.close();
  }

  const reopened = new TranscriptIndex(dbPath);
  try {
    if (!reopened.semanticAvailable()) {
      throw new Error("reopened index did not report persisted embeddings");
    }
    const hits = reopened.search({ query: "unique-fts-term", mode: "fts" });
    const top = hits[0];
    if (top === undefined || !top.text.includes("unique-fts-term") || top.sessionId !== "alpha") {
      throw new Error(`unexpected FTS hit after reopen: ${top?.sessionId} ${top?.text}`);
    }

    const empty = new TranscriptIndex(join(emptyDir, "empty.db"));
    try {
      if (empty.semanticAvailable()) {
        throw new Error("independent empty database reported semantic availability");
      }
    } finally {
      empty.close();
    }

    console.info(
      `SEMANTIC_LIFECYCLE:${JSON.stringify({
        ok: true,
        reopened: true,
        empty: false,
        ftsText: top.text,
        ftsSessionId: top.sessionId,
      })}`,
    );
  } finally {
    reopened.close();
  }
} finally {
  await removeFixtureRoot(root);
  await removeFixtureRoot(indexDir);
  await removeFixtureRoot(emptyDir);
}

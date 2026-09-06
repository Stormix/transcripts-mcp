import { Database } from "bun:sqlite";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolveTranscriptRoot } from "@transcripts-mcp/core";

import { buildIndex, TranscriptIndex } from "../fts.ts";
import { embedCorpus } from "../semantic.ts";
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
  const canonicalRoot = await resolveTranscriptRoot(root);
  const scopes = [{ provider: "fixture", root: canonicalRoot }];
  const built = await buildIndex(registry, { full: true });
  if (built.messages <= 0 || built.semantic) {
    throw new Error("FTS index unexpectedly reported semantic readiness");
  }

  const seed = new Database(dbPath);
  let partial = false;
  let partialAvailable = false;
  let fallback = false;
  let staleFallback = false;
  let invalid = false;
  let thrown = false;
  let insertionFailure = false;
  let retried = false;
  let orphanAvailable = false;
  try {
    let embeddings = 0;
    partial = await embedCorpus(seed, async () => {
      embeddings += 1;
      return embeddings === 1 ? new Float32Array(384) : undefined;
    });
    const partialIndex = TranscriptIndex.open(dbPath);
    try {
      partialAvailable = partialIndex.semanticAvailable();
      const firstFallback = await partialIndex.searchHybrid({ query: "unique-fts-term" }, scopes);
      const secondFallback = await partialIndex.searchHybrid({ query: "unique-fts-term" }, scopes);
      const staleHits = await partialIndex.searchHybrid({ query: "unique-fts-term" }, [
        { provider: "fixture", root: `${canonicalRoot}-stale` },
      ]);
      fallback = firstFallback.length === 1 && secondFallback.length === 1;
      staleFallback = staleHits.length === 0;
    } finally {
      partialIndex.close();
    }
    invalid = await embedCorpus(seed, async () => new Float32Array(2));
    thrown = await embedCorpus(seed, async () => {
      throw new Error("injected embedding failure");
    });
    seed.exec(
      "CREATE TRIGGER reject_embedding BEFORE INSERT ON embeddings BEGIN SELECT RAISE(ABORT, 'injected insertion failure'); END",
    );
    insertionFailure = await embedCorpus(seed, async () => new Float32Array(384));
    seed.exec("DROP TRIGGER reject_embedding");
    retried = await embedCorpus(seed, async () => new Float32Array(384));
    seed.run(
      `INSERT INTO embeddings (path, line_number, provider, source_root, session_id, role, text, effective_timestamp, vector)
       VALUES ('orphan', 1, 'fixture', ?, 'orphan', 'user', 'orphan', '2026-09-06T00:00:00.000Z', ?)`,
      [canonicalRoot, new Uint8Array(new Float32Array(384).buffer)],
    );
    const orphanIndex = TranscriptIndex.open(dbPath);
    try {
      orphanAvailable = orphanIndex.semanticAvailable();
    } finally {
      orphanIndex.close();
    }
    seed.run("DELETE FROM embeddings WHERE path = 'orphan'");
  } finally {
    seed.close();
  }

  const reopened = TranscriptIndex.open(dbPath);
  try {
    if (!reopened.semanticAvailable()) {
      throw new Error("reopened index did not report persisted embeddings");
    }
    const hits = reopened.search({ query: "unique-fts-term", mode: "fts" }, scopes);
    const top = hits[0];
    if (top === undefined || !top.text.includes("unique-fts-term") || top.sessionId !== "alpha") {
      throw new Error(`unexpected FTS hit after reopen: ${top?.sessionId} ${top?.text}`);
    }

    const empty = TranscriptIndex.open(join(emptyDir, "empty.db"));
    try {
      if (empty.semanticAvailable()) {
        throw new Error("independent empty database reported semantic availability");
      }
    } finally {
      empty.close();
    }

    await writeSession(root, "alpha", [messageLine("user", "replacement term")]);
    await reopened.build(registry);
    const modified = reopened.semanticAvailable();
    const refreshed = new Database(dbPath);
    try {
      await embedCorpus(refreshed, async () => new Float32Array(384));
    } finally {
      refreshed.close();
    }
    await rm(join(root, "sessions", "alpha.jsonl"));
    await reopened.build(registry);
    const deleted = reopened.semanticAvailable();

    console.info(
      `SEMANTIC_LIFECYCLE:${JSON.stringify({
        ok: true,
        reopened: true,
        empty: false,
        partial: partial || partialAvailable,
        fallback,
        staleFallback,
        invalid,
        thrown,
        insertionFailure,
        retried,
        orphanAvailable,
        modified,
        deleted,
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

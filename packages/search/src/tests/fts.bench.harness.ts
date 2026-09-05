import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { z } from "zod";

import { buildIndex, searchTranscripts } from "../fts.ts";
import {
  createFixtureRegistry,
  createFixtureRoot,
  removeFixtureRoot,
  writeBulkSessions,
} from "./helpers.ts";

const SESSION_COUNT = 100;
const LINES_PER_SESSION = 10;

const modeSchema = z.enum(["full", "incremental", "search", "all"]);

function parseMode(argv: string[]): z.infer<typeof modeSchema> {
  const flagIndex = argv.indexOf("--mode");
  if (flagIndex === -1) return "all";
  const parsed = modeSchema.safeParse(argv[flagIndex + 1]);
  if (!parsed.success) {
    throw new Error(`invalid --mode: ${argv[flagIndex + 1] ?? "(missing)"}`);
  }
  return parsed.data;
}

const mode = parseMode(process.argv);
const root = await createFixtureRoot();
const indexDir = await mkdtemp(join(tmpdir(), "transcripts-index-bench-"));
process.env.TRANSCRIPTS_MCP_INDEX = join(indexDir, "index.db");

try {
  await writeBulkSessions(root, SESSION_COUNT, LINES_PER_SESSION);
  const registry = createFixtureRegistry(root);

  let fullBuildMs = 0;
  let incrementalMs = 0;
  let searchMs = 0;
  let files = 0;
  let messages = 0;
  let skipped = 0;
  let hits = 0;

  if (mode === "full" || mode === "all") {
    const started = performance.now();
    const built = await buildIndex(registry, { full: true });
    fullBuildMs = performance.now() - started;
    files = built.files;
    messages = built.messages;
    skipped = built.skipped;
  }

  if (mode === "incremental" || mode === "search") {
    const primed = await buildIndex(registry, { full: true });
    files = primed.files;
    messages = primed.messages;
    skipped = primed.skipped;
  }

  if (mode === "incremental" || mode === "all") {
    const started = performance.now();
    const incremental = await buildIndex(registry, { full: false });
    incrementalMs = performance.now() - started;
    files = incremental.files;
    skipped = incremental.skipped;
  }

  if (mode === "search" || mode === "all") {
    const started = performance.now();
    const results = await searchTranscripts(registry, {
      query: "target",
      mode: "fts",
    });
    searchMs = performance.now() - started;
    hits = results.length;
    if (hits === 0) {
      throw new Error("FTS search returned no hits");
    }
  }

  if (mode !== "search" && messages <= 0) {
    throw new Error("FTS index did not index any messages");
  }

  console.info(
    `FTS_BENCH:${JSON.stringify({
      ok: true,
      mode,
      fullBuildMs,
      incrementalMs,
      searchMs,
      files,
      messages,
      skipped,
      hits,
    })}`,
  );
} finally {
  await removeFixtureRoot(root);
  await removeFixtureRoot(indexDir);
}

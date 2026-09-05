import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { test } from "vitest";
import { z } from "zod";

const ftsBenchSchema = z.object({
  ok: z.literal(true),
  mode: z.enum(["full", "incremental", "search", "all"]),
  fullBuildMs: z.number(),
  incrementalMs: z.number(),
  searchMs: z.number(),
  files: z.number(),
  messages: z.number(),
  skipped: z.number(),
  hits: z.number(),
});

type FtsBenchResult = z.infer<typeof ftsBenchSchema>;

const FTS_RUN_OPTIONS = {
  iterations: 1,
  time: 0,
  warmupIterations: 0,
  warmupTime: 0,
};

function runHarness(mode: FtsBenchResult["mode"]): FtsBenchResult {
  const harness = join(import.meta.dirname, "fts.bench.harness.ts");
  const result = spawnSync("bun", ["--bun", harness, "--mode", mode], {
    encoding: "utf8",
    cwd: join(import.meta.dirname, "../.."),
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "fts bench harness failed");
  }
  const line = result.stdout.split(/\r?\n/).find((entry) => entry.startsWith("FTS_BENCH:"));
  if (line === undefined) {
    throw new Error(`missing FTS_BENCH line\n${result.stdout}\n${result.stderr}`);
  }
  const parsed = ftsBenchSchema.safeParse(JSON.parse(line.slice("FTS_BENCH:".length)));
  if (!parsed.success) {
    throw new Error("invalid FTS_BENCH payload");
  }
  return parsed.data;
}

test("buildIndex full", async ({ bench }) => {
  await bench("buildIndex full", () => {
    const payload = runHarness("full");
    if (payload.messages <= 0) throw new Error("FTS full build indexed no messages");
    console.info(`buildIndex full (harness): ${payload.fullBuildMs.toFixed(2)}ms`);
  }).run(FTS_RUN_OPTIONS);
});

test("buildIndex incremental", async ({ bench }) => {
  await bench("buildIndex incremental", () => {
    const payload = runHarness("incremental");
    if (payload.skipped <= 0) throw new Error("FTS incremental build skipped no files");
    console.info(`buildIndex incremental (harness): ${payload.incrementalMs.toFixed(2)}ms`);
  }).run(FTS_RUN_OPTIONS);
});

test("searchTranscripts", async ({ bench }) => {
  await bench("searchTranscripts", () => {
    const payload = runHarness("search");
    if (payload.hits <= 0) throw new Error("FTS search returned no hits");
    console.info(`searchTranscripts (harness): ${payload.searchMs.toFixed(2)}ms`);
  }).run(FTS_RUN_OPTIONS);
});

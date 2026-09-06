import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

import { z } from "zod";

import { hasNewFailures, renderReport } from "./report.ts";
import { comparisonSchema, sampleSchema, type Sample } from "./types.ts";

const { values } = parseArgs({
  options: {
    base: { type: "string" },
    head: { type: "string", default: process.cwd() },
    output: { type: "string", default: "bench-results" },
    samples: { type: "string", default: "7" },
  },
});
const rounds = z.coerce.number().int().min(3).max(30).parse(values.samples);
const suiteFiles = ["harness.ts", "fixture.ts", "measure.ts", "types.ts"];
const digest = createHash("sha256");
for (const file of suiteFiles) digest.update(await readFile(join(import.meta.dirname, file)));
const suiteHash = digest.digest("hex");

async function prepare(root: string) {
  const repo = resolve(root);
  const git = spawnSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" });
  if (git.status !== 0) throw new Error(git.stderr);
  const sha = z
    .string()
    .regex(/^[a-f0-9]{40}$/)
    .parse(git.stdout.trim());
  const directory = await mkdtemp(join(repo, "packages/search/src/.bench-"));
  for (const file of suiteFiles)
    await copyFile(join(import.meta.dirname, file), join(directory, file));
  const samples: Sample[] = [];
  return { directory, sha, samples };
}

async function runSample(directory: string): Promise<Sample> {
  const root = await mkdtemp(join(tmpdir(), "transcripts-bench-"));
  try {
    const result = spawnSync(process.execPath, [join(directory, "harness.ts"), root], {
      encoding: "utf8",
      timeout: 180_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    if (result.status !== 0)
      throw new Error(result.stderr || result.stdout || "Benchmark subprocess failed");
    const payload = result.stdout.split(/\r?\n/).find((line) => line.startsWith("BENCH_RESULT:"));
    if (payload === undefined) throw new Error("Missing benchmark result");
    return sampleSchema.parse(JSON.parse(payload.slice("BENCH_RESULT:".length)));
  } finally {
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

const head = await prepare(values.head);
let base: Awaited<ReturnType<typeof prepare>> | null = null;
try {
  if (values.base !== undefined) base = await prepare(values.base);
  for (let round = 0; round <= rounds; round += 1) {
    const revisions = base === null ? [head] : round % 2 === 0 ? [base, head] : [head, base];
    for (const revision of revisions) {
      console.info(
        `${round === 0 ? "Warm-up" : `Round ${round}/${rounds}`} ${revision === head ? "PR" : "main"} ${revision.sha.slice(0, 7)}`,
      );
      const sample = await runSample(revision.directory);
      if (round > 0) revision.samples.push(sample);
    }
  }
  const comparison = comparisonSchema.parse({
    schemaVersion: 1,
    suiteHash,
    warmupRounds: 1,
    base: base === null ? null : { sha: base.sha, samples: base.samples },
    head: { sha: head.sha, samples: head.samples },
  });
  const markdown = renderReport(comparison);
  const output = resolve(values.output);
  await mkdir(output, { recursive: true });
  await writeFile(join(output, "comparison.json"), JSON.stringify(comparison, null, 2) + "\n");
  await writeFile(join(output, "comparison.md"), markdown);
  console.info(markdown);
  if (hasNewFailures(comparison)) process.exitCode = 1;
} finally {
  await rm(head.directory, { recursive: true, force: true });
  if (base !== null) await rm(base.directory, { recursive: true, force: true });
}

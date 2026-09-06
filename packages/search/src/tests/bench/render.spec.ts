import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { metricIdSchema } from "../../bench/types.ts";

const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "bench-render-test-"));
  directories.push(root);
  const input = join(root, "comparison.json");
  const output = join(root, "report.md");
  const sample = {
    environment: { bun: "1.4.0", platform: "linux", arch: "x64", cpu: "Test" },
    measurements: metricIdSchema.options.map((id) => ({ id, status: "ok", ms: 1 })),
  };
  await writeFile(
    input,
    JSON.stringify({
      schemaVersion: 1,
      suiteHash: "a".repeat(64),
      warmupRounds: 1,
      base: { sha: "b".repeat(40), samples: [sample] },
      head: { sha: "c".repeat(40), samples: [sample] },
    }),
  );
  return { input, output };
}

function render(input: string, output: string, head: string) {
  return spawnSync(
    "bun",
    [join(import.meta.dirname, "../../bench/render.ts"), input, output, "b".repeat(40), head],
    { encoding: "utf8" },
  );
}

describe("benchmark artifact renderer", () => {
  it("should render validated numeric data when the PR commits match", async () => {
    const paths = await fixture();
    const result = render(paths.input, paths.output, "c".repeat(40));
    expect(result.status, result.stderr).toBe(0);
    expect(await readFile(paths.output, "utf8")).toContain("Within noise");
  });

  it("should reject stale artifacts when the PR head has changed", async () => {
    const paths = await fixture();
    const result = render(paths.input, paths.output, "d".repeat(40));
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("do not match");
    await expect(readFile(paths.output)).rejects.toThrow();
  });

  it("should reject oversized artifacts before parsing", async () => {
    const paths = await fixture();
    await writeFile(paths.input, "x".repeat(1024 * 1024 + 1));
    const result = render(paths.input, paths.output, "c".repeat(40));
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("size limit");
  });
});

import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { z } from "zod";

const resultSchema = z.object({
  success: z.boolean(),
  embeddedExactlyOnce: z.boolean(),
  batchSizes: z.array(z.number()),
  pageSize: z.number(),
  rowCount: z.number(),
  identityMismatches: z.number(),
  successEmbeddings: z.number(),
  failed: z.boolean(),
  committedBeforeRetry: z.number(),
  incompleteBeforeRetry: z.boolean(),
  retried: z.boolean(),
  retryEmbeddings: z.number(),
  completeAfterRetry: z.boolean(),
});

function runHarness() {
  const harness = join(import.meta.dirname, "semantic-batch.harness.ts");
  const result = spawnSync("bun", ["--bun", harness], {
    encoding: "utf8",
    cwd: join(import.meta.dirname, "../.."),
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "semantic batch harness failed");
  }
  const line = result.stdout.split(/\r?\n/).find((entry) => entry.startsWith("SEMANTIC_BATCH:"));
  return resultSchema.parse(JSON.parse(line?.slice("SEMANTIC_BATCH:".length) ?? "null"));
}

describe("semantic corpus batching", () => {
  it("should embed each row once when the corpus spans multiple pages", () => {
    const result = runHarness();
    expect(result.success).toBe(true);
    expect(result.embeddedExactlyOnce).toBe(true);
    expect(result.batchSizes).toEqual([
      result.pageSize,
      result.pageSize,
      result.rowCount - result.pageSize * 2,
    ]);
    expect(result.identityMismatches).toBe(0);
    expect(result.successEmbeddings).toBe(300);
  });

  it("should commit only complete pages when a later page fails", () => {
    const result = runHarness();
    expect(result.failed).toBe(false);
    expect(result.committedBeforeRetry).toBe(result.pageSize);
    expect(result.incompleteBeforeRetry).toBe(true);
    expect(result.retried).toBe(true);
    expect(result.retryEmbeddings).toBe(300);
    expect(result.completeAfterRetry).toBe(true);
  });
});

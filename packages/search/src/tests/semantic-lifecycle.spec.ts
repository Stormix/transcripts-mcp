import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { z } from "zod";

const lifecycleSchema = z.object({
  ok: z.literal(true),
  reopened: z.boolean(),
  empty: z.boolean(),
  ftsText: z.string(),
  ftsSessionId: z.string(),
});

type LifecycleResult = z.infer<typeof lifecycleSchema>;

function runLifecycleHarness(): LifecycleResult {
  const harness = join(import.meta.dirname, "semantic-lifecycle.harness.ts");
  const result = spawnSync("bun", ["--bun", harness], {
    encoding: "utf8",
    cwd: join(import.meta.dirname, "../.."),
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "semantic lifecycle harness failed");
  }
  const line = result.stdout
    .split(/\r?\n/)
    .find((entry) => entry.startsWith("SEMANTIC_LIFECYCLE:"));
  const parsed = lifecycleSchema.safeParse(
    JSON.parse(line?.slice("SEMANTIC_LIFECYCLE:".length) ?? "null"),
  );
  if (!parsed.success) {
    throw new Error("semantic lifecycle harness returned an invalid payload");
  }
  return parsed.data;
}

let cached: LifecycleResult | undefined;

function lifecycle(): LifecycleResult {
  cached ??= runLifecycleHarness();
  return cached;
}

describe("semantic lifecycle", () => {
  it("should report semantic availability after reopening an index that has persisted embeddings", () => {
    expect(lifecycle().reopened).toBe(true);
  });

  it("should report no semantic availability for an independent empty database", () => {
    expect(lifecycle().empty).toBe(false);
  });

  it("should return FTS hits when embeddings exist but the model is unavailable", () => {
    const payload = lifecycle();
    expect(payload.ftsText).toContain("unique-fts-term");
    expect(payload.ftsSessionId).toBe("alpha");
  });
});

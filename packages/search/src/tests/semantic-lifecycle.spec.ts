import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { z } from "zod";

const lifecycleSchema = z.object({
  ok: z.literal(true),
  reopened: z.boolean(),
  empty: z.boolean(),
  partial: z.boolean(),
  fallback: z.boolean(),
  invalid: z.boolean(),
  thrown: z.boolean(),
  insertionFailure: z.boolean(),
  retried: z.boolean(),
  orphanAvailable: z.boolean(),
  modified: z.boolean(),
  deleted: z.boolean(),
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
  const fallbackDiagnostics = result.stderr.match(
    /search_transcripts hybrid falling back to fts: no embeddings in index/g,
  );
  if (fallbackDiagnostics?.length !== 1) {
    throw new Error(`expected one hybrid fallback diagnostic, received ${result.stderr}`);
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

  it("should remain incomplete when semantic construction fails partway", () => {
    expect(lifecycle().partial).toBe(false);
    expect(lifecycle().invalid).toBe(false);
    expect(lifecycle().thrown).toBe(false);
    expect(lifecycle().insertionFailure).toBe(false);
  });

  it("should return FTS results when the semantic state is incomplete", () => {
    expect(lifecycle().fallback).toBe(true);
  });

  it("should become complete when semantic construction retries successfully", () => {
    expect(lifecycle().retried).toBe(true);
  });

  it("should become incomplete when FTS content changes or is deleted", () => {
    expect(lifecycle().modified).toBe(false);
    expect(lifecycle().deleted).toBe(false);
  });

  it("should reject semantic completeness when an orphan embedding exists", () => {
    expect(lifecycle().orphanAvailable).toBe(false);
  });
});

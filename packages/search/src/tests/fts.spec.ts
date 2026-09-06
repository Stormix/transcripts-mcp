import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { z } from "zod";

const ftsResultSchema = z.object({
  ok: z.literal(true),
  text: z.string(),
  sessionId: z.string(),
  provider: z.string(),
  messages: z.number(),
  cwdHits: z.number(),
  slashCwdHits: z.number(),
  slugHits: z.number(),
  roleUserHits: z.number(),
  offsetDateHits: z.number(),
  utcDateHits: z.number(),
  sinceHits: z.number(),
  untilHits: z.number(),
  excludedByMtime: z.number(),
  excludedByUntil: z.number(),
  authoredTimestamp: z.string().nullable(),
  firstRootHits: z.number(),
  staleRootHits: z.number(),
  unavailableHits: z.number(),
  secondRootHits: z.number(),
  multiRootHits: z.number(),
});

describe("fts", () => {
  it("should rank an FTS hit for a known term", () => {
    const harness = join(import.meta.dirname, "fts.harness.ts");
    const result = spawnSync("bun", ["--bun", harness], {
      encoding: "utf8",
      cwd: join(import.meta.dirname, "../.."),
    });
    expect(result.status, result.stderr || result.stdout).toBe(0);
    const line = result.stdout.split(/\r?\n/).find((entry) => entry.startsWith("FTS_RESULT:"));
    expect(line).toBeDefined();
    const payload = line?.slice("FTS_RESULT:".length);
    expect(payload).toBeTypeOf("string");
    const parsed = ftsResultSchema.safeParse(JSON.parse(payload ?? "null"));
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.text).toContain("unique-fts-term");
    expect(parsed.data.sessionId).toBe("alpha");
    expect(parsed.data.provider).toBe("fixture");
    expect(parsed.data.messages).toBeGreaterThan(0);
    expect(parsed.data.cwdHits).toBe(1);
    expect(parsed.data.slugHits).toBe(1);
    expect(parsed.data.roleUserHits).toBe(1);
    expect(parsed.data.offsetDateHits).toBe(1);
    expect(parsed.data.utcDateHits).toBe(1);
    expect(parsed.data.sinceHits).toBe(1);
    expect(parsed.data.untilHits).toBe(1);
    expect(parsed.data.excludedByMtime).toBe(0);
    expect(parsed.data.excludedByUntil).toBe(0);
    expect(parsed.data.authoredTimestamp).toBeNull();
    expect(parsed.data.firstRootHits).toBe(1);
    expect(parsed.data.staleRootHits).toBe(0);
    expect(parsed.data.unavailableHits).toBe(0);
    expect(parsed.data.secondRootHits).toBe(1);
    expect(parsed.data.multiRootHits).toBe(2);
    if (process.platform === "win32") {
      expect(parsed.data.slashCwdHits).toBe(1);
    }
  });
});

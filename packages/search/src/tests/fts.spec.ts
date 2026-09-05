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
    if (process.platform === "win32") {
      expect(parsed.data.slashCwdHits).toBe(1);
    }
  });
});

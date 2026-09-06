import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("index builds", () => {
  it("should cancel and resume without damaging other files when indexing or embedding is interrupted", () => {
    const result = spawnSync(
      "bun",
      ["--bun", join(import.meta.dirname, "build-control.harness.ts")],
      {
        encoding: "utf8",
        timeout: 30_000,
      },
    );
    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(result.stdout).toContain("BUILD_CONTROL_OK");
  });
});

import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("semantic filters", () => {
  it.each(["provider", "role", "cwd", "slug", "since", "offset", "until", "undated", "combined"])(
    "should return the nearest matching result when closer vectors fail the %s filter",
    (scenario) => {
      const result = spawnSync(
        "bun",
        ["--bun", join(import.meta.dirname, "semantic-filters.harness.ts"), scenario],
        { encoding: "utf8" },
      );
      expect(result.status, result.stderr || result.stdout).toBe(0);
      expect(result.stdout).toContain("FILTER_OK");
    },
  );
});

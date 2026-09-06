import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("atomic reindexing", () => {
  it.each(["parse", "write", "full-parse", "full-write"])(
    "should preserve indexed messages and embeddings when a %s rebuild fails",
    (scenario) => {
      const result = spawnSync(
        "bun",
        ["--bun", join(import.meta.dirname, "reindex.harness.ts"), scenario],
        { encoding: "utf8" },
      );
      expect(result.status, result.stderr || result.stdout).toBe(0);
      expect(result.stdout).toContain("REINDEX_OK");
    },
  );
});

import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("index schema compatibility", () => {
  it("should reject an incompatible index without changing its cached rows", () => {
    const result = spawnSync(
      "bun",
      ["--bun", join(import.meta.dirname, "schema-compatibility.harness.ts")],
      { encoding: "utf8" },
    );
    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(result.stdout).toContain("SCHEMA_COMPATIBILITY_OK");
    expect(result.stdout).toContain("FRESH_SCHEMA_OK");
    expect(result.stdout).toContain("FAILED_REBUILD_RETRY_OK");
    expect(result.stdout).toContain("UNVERSIONED_SCHEMA_OK");
  });

  it("should reject older, newer, and malformed index schemas without mutation", () => {
    const result = spawnSync(
      "bun",
      ["--bun", join(import.meta.dirname, "schema-compatibility-matrix.harness.ts")],
      { encoding: "utf8" },
    );
    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(result.stdout).toContain("SCHEMA_COMPATIBILITY_MATRIX_OK");
  });

  it("should retain the rebuild marker after a write failure or process termination", () => {
    const result = spawnSync(
      "bun",
      ["--bun", join(import.meta.dirname, "schema-rebuild-failure.harness.ts")],
      { encoding: "utf8" },
    );
    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(result.stdout).toContain("SCHEMA_REBUILD_FAILURE_OK");
  });
});

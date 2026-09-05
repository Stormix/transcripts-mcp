import { describe, expect, it } from "vitest";

import { hostTarget, targetFor } from "../targets.ts";

describe("cli targets", () => {
  it("should map win32-x64 to the windows bun compile target", () => {
    const target = hostTarget("win32", "x64");
    expect(target.packageName).toBe("transcripts-mcp-win32-x64");
    expect(target.bunTarget).toBe("bun-windows-x64");
    expect(target.binaryFile).toBe("transcripts-mcp.exe");
  });

  it("should return undefined when the platform is not shipped", () => {
    expect(targetFor("win32", "arm64")).toBeUndefined();
  });

  it("should throw when hostTarget is asked for an unsupported pair", () => {
    expect(() => hostTarget("aix", "ppc64")).toThrow(/unsupported platform/);
  });
});

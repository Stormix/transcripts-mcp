import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { optionalBinaryPath, overrideBinaryPath } from "../resolve.ts";

describe("cli resolve", () => {
  it("should read TRANSCRIPTS_MCP_BINARY when it is set", () => {
    expect(overrideBinaryPath({ TRANSCRIPTS_MCP_BINARY: "/tmp/custom" })).toBe("/tmp/custom");
  });

  it("should ignore an empty override", () => {
    expect(overrideBinaryPath({ TRANSCRIPTS_MCP_BINARY: "" })).toBeUndefined();
  });

  it("should join the platform package directory with the binary file name", () => {
    const path = optionalBinaryPath("transcripts-mcp-win32-x64", "transcripts-mcp.exe", () =>
      join("/pkg", "package.json"),
    );
    expect(path).toBe(join("/pkg", "transcripts-mcp.exe"));
  });

  it("should return undefined when the platform package cannot be resolved", () => {
    const path = optionalBinaryPath("transcripts-mcp-missing", "transcripts-mcp", () => {
      throw new Error("not installed");
    });
    expect(path).toBeUndefined();
  });
});

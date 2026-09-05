import { describe, expect, it } from "vitest";

import { matchesCwdFilter, slugifyCwd } from "../paths";

describe("slugifyCwd", () => {
  it("should slugify a windows path the way Cursor encodes project folders", () => {
    expect(slugifyCwd("V:\\dev\\transcripts-mcp")).toBe("v-dev-transcripts-mcp");
    expect(slugifyCwd("V:/dev/transcripts-mcp")).toBe("v-dev-transcripts-mcp");
  });

  it("should slugify a workspace file path including the extension", () => {
    expect(
      slugifyCwd("V:\\dev\\deadlock-modmanager\\vscode-deadlock-modmanager.code-workspace"),
    ).toBe("v-dev-deadlock-modmanager-vscode-deadlock-modmanager-code-workspace");
  });

  it("should collapse mixed separators and trailing slashes", () => {
    expect(slugifyCwd("V:\\dev\\transcripts-mcp\\")).toBe("v-dev-transcripts-mcp");
    expect(slugifyCwd("/tmp/demo")).toBe("tmp-demo");
  });
});

describe("matchesCwdFilter", () => {
  it("should match a stored cwd after path normalization", () => {
    expect(matchesCwdFilter("/tmp/demo", "/tmp/demo", undefined)).toBe(true);
  });

  it("should match a stored project slug when cwd is absent", () => {
    expect(matchesCwdFilter("V:\\dev\\transcripts-mcp", undefined, "v-dev-transcripts-mcp")).toBe(
      true,
    );
  });

  it("should reject when neither cwd nor slug matches", () => {
    expect(matchesCwdFilter("V:\\dev\\other", undefined, "v-dev-transcripts-mcp")).toBe(false);
  });
});

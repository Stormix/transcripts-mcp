import { describe, expect, it } from "vitest";

import { pageFromHtmlFilename, pageFromPath } from "../lib/page";

describe("pageFromPath", () => {
  it("should return privacy when the path is /privacy or /privacy/", () => {
    expect(pageFromPath("/privacy")).toBe("privacy");
    expect(pageFromPath("/privacy/")).toBe("privacy");
  });

  it("should return faq when the path is /faq or /faq/", () => {
    expect(pageFromPath("/faq")).toBe("faq");
    expect(pageFromPath("/faq/")).toBe("faq");
  });

  it("should return home for the root and for unknown paths", () => {
    expect(pageFromPath("/")).toBe("home");
    expect(pageFromPath("")).toBe("home");
    expect(pageFromPath("/nope")).toBe("home");
  });
});

describe("pageFromHtmlFilename", () => {
  it("should return privacy for a privacy index html path", () => {
    expect(pageFromHtmlFilename("V:/dev/transcripts-mcp/apps/www/privacy/index.html")).toBe(
      "privacy",
    );
    expect(pageFromHtmlFilename("V:\\dev\\transcripts-mcp\\apps\\www\\privacy\\index.html")).toBe(
      "privacy",
    );
  });

  it("should return faq for a faq index html path", () => {
    expect(pageFromHtmlFilename("/apps/www/faq/index.html")).toBe("faq");
  });

  it("should return home for the root index html", () => {
    expect(pageFromHtmlFilename("/apps/www/index.html")).toBe("home");
  });
});

import { describe, expect, it } from "vitest";

import { titleFromText } from "../content.ts";

describe("titleFromText", () => {
  it("should prefer the inner text of a user_query block", () => {
    expect(
      titleFromText(
        "<timestamp>Saturday, Sep 5, 2026, 10:02 PM (UTC+2)</timestamp>\n<user_query>\nIt would be nice to have a benchmark\n</user_query>",
      ),
    ).toBe("It would be nice to have a benchmark");
  });

  it("should drop paired wrapper blocks when there is no user_query", () => {
    expect(
      titleFromText("<app-context> # Codex desktop context - You are running inside</app-context>"),
    ).toBeUndefined();
  });

  it("should strip a leading leftover tag after wrappers are removed", () => {
    expect(titleFromText("<timestamp>Saturday</timestamp>\n<user_query>hello")).toBe("hello");
  });

  it("should still truncate a long cleaned title", () => {
    const title = titleFromText(`<user_query>${"a".repeat(100)}</user_query>`);
    expect(title).toBe(`${"a".repeat(77)}...`);
  });
});

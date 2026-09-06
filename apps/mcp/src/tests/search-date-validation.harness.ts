import assert from "node:assert/strict";

import { createRegistry } from "@transcripts-mcp/core";

import { searchTranscripts, toSearchQuery } from "../tools/search-transcripts.ts";
import { runTool } from "../utils.ts";

const normalized = toSearchQuery({
  query: "term",
  since: "2026-09-01T02:00:00+02:00",
  until: "2026-09-02T02:00:00+02:00",
});
assert.equal(normalized.since, "2026-09-01T00:00:00.000Z");
assert.equal(normalized.until, "2026-09-02T00:00:00.000Z");

const invalid = await runTool(() =>
  searchTranscripts(createRegistry(), { query: "term", since: "not-a-date" }),
);
assert.deepEqual(invalid, {
  content: [{ type: "text", text: "Invalid ISO date: not-a-date" }],
  isError: true,
});

const reversed = await runTool(() =>
  searchTranscripts(createRegistry(), {
    query: "term",
    since: "2026-09-03T00:00:00Z",
    until: "2026-09-02T00:00:00Z",
  }),
);
assert.deepEqual(reversed, {
  content: [
    {
      type: "text",
      text: "Search date range requires since to be before or equal to until",
    },
  ],
  isError: true,
});

console.info("SEARCH_DATE_VALIDATION_OK");

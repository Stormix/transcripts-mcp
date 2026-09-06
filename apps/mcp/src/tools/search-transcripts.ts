import type { McpServer } from "@modelcontextprotocol/server";

import type { AdapterRegistry } from "@transcripts-mcp/core";
import type { SearchQuery } from "@transcripts-mcp/search";

import * as z from "zod/v4";

import { normalizeSearchQueryDates, searchTranscripts as runSearch } from "@transcripts-mcp/search";

import { runTool } from "../utils.ts";

const searchTranscriptsInputSchema = z.object({
  query: z.string().min(1),
  mode: z.enum(["fts", "hybrid"]).optional(),
  provider: z.string().optional(),
  role: z.string().optional(),
  cwd: z.string().optional(),
  since: z.string().optional(),
  until: z.string().optional(),
  limit: z.number().int().positive().max(100).optional(),
});

export type SearchTranscriptsInput = z.infer<typeof searchTranscriptsInputSchema>;

export function registerSearchTranscripts(server: McpServer, registry: AdapterRegistry): void {
  server.registerTool(
    "search_transcripts",
    {
      description:
        "BM25-ranked search over normalized messages. mode=fts (default) or mode=hybrid after a semantic index build.",
      inputSchema: searchTranscriptsInputSchema,
    },
    async (input) => runTool(() => searchTranscripts(registry, input)),
  );
}

export async function searchTranscripts(registry: AdapterRegistry, input: SearchTranscriptsInput) {
  return runSearch(registry, toSearchQuery(input));
}

export function toSearchQuery(input: SearchTranscriptsInput): SearchQuery {
  return normalizeSearchQueryDates({
    query: input.query,
    mode: input.mode ?? "fts",
    provider: input.provider,
    role: input.role,
    cwd: input.cwd,
    since: input.since,
    until: input.until,
    limit: input.limit,
  });
}

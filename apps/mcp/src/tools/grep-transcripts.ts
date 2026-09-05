import type { McpServer } from "@modelcontextprotocol/server";

import type { AdapterRegistry } from "@transcripts-mcp/core";

import * as z from "zod/v4";

import { grepTranscripts as searchGrep } from "@transcripts-mcp/search";

import { runTool } from "../result.ts";

export const grepTranscriptsInputSchema = z.object({
  query: z.string().min(1),
  mode: z.enum(["plain", "regex", "fuzzy"]).optional(),
  provider: z.string().optional(),
  limit: z.number().int().positive().max(200).optional(),
});

export type GrepTranscriptsInput = z.infer<typeof grepTranscriptsInputSchema>;

export function registerGrepTranscripts(server: McpServer, registry: AdapterRegistry): void {
  server.registerTool(
    "grep_transcripts",
    {
      description:
        "Search raw transcript files (plain, regex, or fuzzy; default fuzzy). Hits are normalized through adapters. Falls back to streaming if the native grep index is unavailable.",
      inputSchema: grepTranscriptsInputSchema,
    },
    async (input) => runTool(() => grepTranscripts(registry, input)),
  );
}

export async function grepTranscripts(registry: AdapterRegistry, input: GrepTranscriptsInput) {
  return searchGrep(registry, {
    query: input.query,
    mode: input.mode ?? "fuzzy",
    provider: input.provider,
    limit: input.limit,
  });
}

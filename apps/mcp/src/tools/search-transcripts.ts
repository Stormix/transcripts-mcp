import type { McpServer } from "@modelcontextprotocol/server";

import type { AdapterRegistry } from "@transcripts-mcp/core";
import type { SearchQuery } from "@transcripts-mcp/search";

import * as z from "zod/v4";

import { toolContracts } from "@transcripts-mcp/contracts";
import { normalizeSearchQueryDates, searchTranscripts as runSearch } from "@transcripts-mcp/search";

import { runTool } from "../utils.ts";

const contract = toolContracts.searchTranscripts;
const searchTranscriptsInputSchema = z.object({
  query: z.string().min(contract.inputs.query.minLength),
  mode: z.enum(contract.inputs.mode.values).default(contract.inputs.mode.default),
  provider: z.string().optional(),
  role: z.string().optional(),
  cwd: z.string().optional(),
  since: z.string().optional(),
  until: z.string().optional(),
  limit: z
    .number()
    .int()
    .min(contract.inputs.limit.minimum)
    .max(contract.inputs.limit.maximum)
    .default(contract.inputs.limit.default),
});

export type SearchTranscriptsInput = z.input<typeof searchTranscriptsInputSchema>;

export function registerSearchTranscripts(server: McpServer, registry: AdapterRegistry): void {
  server.registerTool(
    contract.name,
    {
      description: contract.description,
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
    mode: input.mode ?? contract.inputs.mode.default,
    provider: input.provider,
    role: input.role,
    cwd: input.cwd,
    since: input.since,
    until: input.until,
    limit: input.limit,
  });
}

import type { McpServer } from "@modelcontextprotocol/server";

import type { AdapterRegistry } from "@transcripts-mcp/core";

import * as z from "zod/v4";

import { toolContracts } from "@transcripts-mcp/contracts";
import { grepTranscripts as searchGrep } from "@transcripts-mcp/search";

import { runTool } from "../utils.ts";

const contract = toolContracts.grepTranscripts;
const grepTranscriptsInputSchema = z.object({
  query: z.string().min(contract.inputs.query.minLength).max(contract.inputs.query.maxLength),
  mode: z.enum(contract.inputs.mode.values).default(contract.inputs.mode.default),
  provider: z.string().optional(),
  limit: z
    .number()
    .int()
    .min(contract.inputs.limit.minimum)
    .max(contract.inputs.limit.maximum)
    .default(contract.inputs.limit.default),
});

type GrepTranscriptsInput = z.infer<typeof grepTranscriptsInputSchema>;

export function registerGrepTranscripts(server: McpServer, registry: AdapterRegistry): void {
  server.registerTool(
    contract.name,
    {
      description: contract.description,
      inputSchema: grepTranscriptsInputSchema,
    },
    async (input) => runTool(() => grepTranscripts(registry, input)),
  );
}

async function grepTranscripts(registry: AdapterRegistry, input: GrepTranscriptsInput) {
  return searchGrep(registry, {
    query: input.query,
    mode: input.mode,
    provider: input.provider,
    limit: input.limit,
  });
}

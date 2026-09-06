import type { McpServer } from "@modelcontextprotocol/server";

import type { AdapterRegistry, Session } from "@transcripts-mcp/core";

import * as z from "zod/v4";

import { toolContracts } from "@transcripts-mcp/contracts";

import { requireAdapter, runTool } from "../utils.ts";

const contract = toolContracts.getTranscript;
const getTranscriptInputSchema = z.object({
  provider: z.string(),
  id: z.string(),
  path: z.string().optional(),
  limit: z
    .number()
    .int()
    .min(contract.inputs.limit.minimum)
    .max(contract.inputs.limit.maximum)
    .default(contract.inputs.limit.default),
});

export type GetTranscriptInput = z.input<typeof getTranscriptInputSchema>;

export function registerGetTranscript(server: McpServer, registry: AdapterRegistry): void {
  server.registerTool(
    contract.name,
    {
      description: contract.description,
      inputSchema: getTranscriptInputSchema,
    },
    async (input) => runTool(() => getTranscript(registry, input)),
  );
}

export async function getTranscript(
  registry: AdapterRegistry,
  input: GetTranscriptInput,
): Promise<Session> {
  const adapter = requireAdapter(registry, input.provider);
  const session = await adapter.readSession(
    {
      provider: input.provider,
      id: input.id,
      path: input.path,
    },
    {
      messageLimit: input.limit ?? contract.inputs.limit.default,
    },
  );
  return session;
}

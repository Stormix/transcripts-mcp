import type { McpServer } from "@modelcontextprotocol/server";

import type { AdapterRegistry, Session } from "@transcripts-mcp/core";

import * as z from "zod/v4";

import { defaultMessageLimit } from "../constants.ts";
import { requireAdapter, runTool } from "../utils.ts";

const getTranscriptInputSchema = z.object({
  provider: z.string(),
  id: z.string(),
  path: z.string().optional(),
  limit: z.number().int().positive().max(1000).optional(),
});

export type GetTranscriptInput = z.infer<typeof getTranscriptInputSchema>;

export function registerGetTranscript(server: McpServer, registry: AdapterRegistry): void {
  server.registerTool(
    "get_transcript",
    {
      description:
        "Return the normalized transcript for one session (provider + id, optional path). Messages are capped (default 200, max 1000).",
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
      messageLimit: input.limit ?? defaultMessageLimit,
    },
  );
  return session;
}

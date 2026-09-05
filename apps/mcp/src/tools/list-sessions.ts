import type { McpServer } from "@modelcontextprotocol/server";

import type { AdapterRegistry, ListOptions, SessionSummary } from "@transcripts-mcp/core";

import * as z from "zod/v4";

import { parseIso } from "../iso.ts";
import { runTool } from "../result.ts";
import { adaptersFor } from "../select.ts";

const defaultLimit = 50;

export const listSessionsInputSchema = z.object({
  provider: z.string().optional(),
  cwd: z.string().optional(),
  since: z.string().optional(),
  until: z.string().optional(),
  limit: z.number().int().positive().max(200).optional(),
});

export type ListSessionsInput = z.infer<typeof listSessionsInputSchema>;

export function registerListSessions(server: McpServer, registry: AdapterRegistry): void {
  server.registerTool(
    "list_sessions",
    {
      description:
        "List session summaries filtered by provider, cwd, and time range. Newest first. Does not return full transcripts.",
      inputSchema: listSessionsInputSchema,
    },
    async (input) => runTool(() => listSessions(registry, input)),
  );
}

export async function listSessions(
  registry: AdapterRegistry,
  input: ListSessionsInput,
): Promise<SessionSummary[]> {
  if (input.provider !== undefined && registry.get(input.provider) === undefined) {
    throw new Error(`Unknown provider: ${input.provider}`);
  }

  const limit = input.limit ?? defaultLimit;
  const opts = toListOptions(input, limit);
  const sessions: SessionSummary[] = [];

  for (const adapter of adaptersFor(registry, input.provider)) {
    if (!(await adapter.isAvailable())) continue;
    for await (const summary of adapter.listSessions(opts)) {
      sessions.push(summary);
    }
  }

  sessions.sort((left, right) => right.mtime.getTime() - left.mtime.getTime());
  return sessions.slice(0, limit);
}

function toListOptions(input: ListSessionsInput, limit: number): ListOptions {
  return {
    provider: input.provider,
    cwd: input.cwd,
    since: parseIso(input.since),
    until: parseIso(input.until),
    limit,
  };
}

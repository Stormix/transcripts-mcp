import type { McpServer } from "@modelcontextprotocol/server";

import * as z from "zod/v4";

import { toolContracts } from "@transcripts-mcp/contracts";
import { walkGlob, type AdapterRegistry, type TranscriptAdapter } from "@transcripts-mcp/core";

import { sessionCountCap } from "../constants.ts";
import { runTool } from "../utils.ts";

const listProvidersInputSchema = z.object({});
const contract = toolContracts.listProviders;

export function registerListProviders(server: McpServer, registry: AdapterRegistry): void {
  server.registerTool(
    contract.name,
    {
      description: contract.description,
      inputSchema: listProvidersInputSchema,
    },
    async () => runTool(() => listProviders(registry)),
  );
}

export async function listProviders(registry: AdapterRegistry) {
  const providers = [];
  for (const adapter of registry.list()) {
    const available = await adapter.isAvailable();
    if (!available) {
      providers.push({
        id: adapter.id,
        displayName: adapter.displayName,
        available: false,
      });
      continue;
    }
    const sessionCount = await countSessionFiles(adapter);
    if (sessionCount === undefined) {
      providers.push({
        id: adapter.id,
        displayName: adapter.displayName,
        available: true,
      });
      continue;
    }
    providers.push({
      id: adapter.id,
      displayName: adapter.displayName,
      available: true,
      sessionCount,
    });
  }
  return providers;
}

async function countSessionFiles(adapter: TranscriptAdapter): Promise<number | undefined> {
  let count = 0;
  for await (const path of walkGlob(adapter.root(), adapter.sessionFiles)) {
    void path;
    count += 1;
    if (count > sessionCountCap) return undefined;
  }
  return count;
}

import type { McpServer } from "@modelcontextprotocol/server";

import type { AdapterRegistry } from "@transcripts-mcp/core";

import * as z from "zod/v4";

import { toolContracts } from "@transcripts-mcp/contracts";
import { buildIndex as runBuildIndex } from "@transcripts-mcp/search";

import { runTool } from "../utils.ts";

const contract = toolContracts.buildIndex;
const buildIndexInputSchema = z.object({
  full: z.boolean().default(contract.inputs.full.default),
  semantic: z.boolean().default(contract.inputs.semantic.default),
});

type BuildIndexInput = z.infer<typeof buildIndexInputSchema>;

export function registerBuildIndex(server: McpServer, registry: AdapterRegistry): void {
  server.registerTool(
    contract.name,
    {
      description: contract.description,
      inputSchema: buildIndexInputSchema,
    },
    async (input) => runTool(() => buildIndex(registry, input)),
  );
}

async function buildIndex(registry: AdapterRegistry, input: BuildIndexInput) {
  const started = Date.now();
  const result = await runBuildIndex(registry, {
    full: input.full,
    semantic: input.semantic,
  });
  return {
    files: result.files,
    messages: result.messages,
    skipped: result.skipped,
    semantic: result.semantic,
    durationMs: Date.now() - started,
  };
}

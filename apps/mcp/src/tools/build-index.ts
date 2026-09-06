import type { McpServer, ServerContext } from "@modelcontextprotocol/server";

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
    async (input, context) => runTool(() => buildIndex(registry, input, context)),
  );
}

async function buildIndex(
  registry: AdapterRegistry,
  input: BuildIndexInput,
  context: ServerContext,
) {
  const started = Date.now();
  const { _meta: metadata } = context.mcpReq;
  const progressToken = metadata?.progressToken;
  let updates = 0;
  let lastUpdate = Number.NEGATIVE_INFINITY;
  let lastPhase = "";
  const result = await runBuildIndex(registry, {
    full: input.full,
    semantic: input.semantic,
    signal: context.mcpReq.signal,
    onProgress: async (progress) => {
      if (progressToken === undefined) return;
      const now = Date.now();
      if (progress.phase === lastPhase && now - lastUpdate < 1000) return;
      lastUpdate = now;
      lastPhase = progress.phase;
      await context.mcpReq.notify({
        method: "notifications/progress",
        params: {
          progressToken,
          progress: updates++,
          message: `${progress.phase}: ${progress.files} files indexed, ${progress.skipped} skipped, ${progress.messages} messages, ${progress.embedded} embedded`,
        },
      });
    },
  });
  return { ...result, durationMs: Date.now() - started };
}

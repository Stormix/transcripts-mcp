import type { McpServer } from "@modelcontextprotocol/server";

import type { AdapterRegistry } from "@transcripts-mcp/core";

import * as z from "zod/v4";

import { buildIndex as runBuildIndex } from "@transcripts-mcp/search";

import { runTool } from "../utils.ts";

const buildIndexInputSchema = z.object({
  full: z.boolean().optional(),
  semantic: z.boolean().optional(),
});

type BuildIndexInput = z.infer<typeof buildIndexInputSchema>;

export function registerBuildIndex(server: McpServer, registry: AdapterRegistry): void {
  server.registerTool(
    "build_index",
    {
      description:
        "Build or refresh the FTS5 index. Pass full=true to rebuild from scratch. Pass semantic=true to also embed the corpus — first run downloads ~23MB ONNX (all-MiniLM-L6-v2).",
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

import { McpServer } from "@modelcontextprotocol/server";

import { allAdapters } from "@transcripts-mcp/adapters";
import { createRegistry, type AdapterRegistry } from "@transcripts-mcp/core";

import { serverName, serverVersion, toolNames } from "./constants.ts";
import { registerBuildIndex } from "./tools/build-index.ts";
import { registerGetTranscript } from "./tools/get-transcript.ts";
import { registerGrepTranscripts } from "./tools/grep-transcripts.ts";
import { registerListProviders } from "./tools/list-providers.ts";
import { registerListSessions } from "./tools/list-sessions.ts";
import { registerSearchTranscripts } from "./tools/search-transcripts.ts";

export { toolNames };

export interface CreateServerOptions {
  registry?: AdapterRegistry;
}

export function createServer(options: CreateServerOptions = {}): McpServer {
  const registry = options.registry ?? createRegistry([...allAdapters]);
  const server = new McpServer({ name: serverName, version: serverVersion });

  registerListProviders(server, registry);
  registerListSessions(server, registry);
  registerGetTranscript(server, registry);
  registerGrepTranscripts(server, registry);
  registerSearchTranscripts(server, registry);
  registerBuildIndex(server, registry);

  return server;
}

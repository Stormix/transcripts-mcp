import { serveStdio } from "@modelcontextprotocol/server/stdio";

import { createServer } from "./server.ts";

console.error("transcripts-mcp 0.0.0 stdio");
void serveStdio(() => createServer());

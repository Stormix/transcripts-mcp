import { serveStdio } from "@modelcontextprotocol/server/stdio";

import { serverName, serverVersion } from "./constants.ts";
import { createServer } from "./server.ts";

console.error(`${serverName} ${serverVersion} stdio`);
void serveStdio(() => createServer());

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

const versionSchema = z.object({ version: z.string() });
const pluginSchema = z.object({
  name: z.string(),
  description: z.string(),
  version: z.string(),
  author: z.object({
    name: z.string(),
  }),
  keywords: z.array(z.string()),
  license: z.string(),
  logo: z.string(),
  repository: z.string(),
  variables: z
    .object({
      type: z.literal("object"),
      properties: z.object({
        GITHUB_TOKEN: z.object({
          type: z.literal("string"),
          title: z.string(),
          description: z.string(),
        }),
      }),
      required: z.array(z.string()),
    })
    .optional(),
});
const mcpSchema = z.object({
  mcpServers: z.object({
    transcripts: z.object({
      command: z.string(),
      args: z.array(z.string()),
      env: z.record(z.string(), z.string()).optional(),
    }),
  }),
});

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const version = versionSchema.parse(
  JSON.parse(await readFile(join(repoRoot, "packages", "cli", "package.json"), "utf8")),
).version;

const pluginPath = join(repoRoot, "plugin", ".cursor-plugin", "plugin.json");
const plugin = pluginSchema.parse(JSON.parse(await readFile(pluginPath, "utf8")));
plugin.version = version;
await writeFile(pluginPath, `${JSON.stringify(plugin, null, 2)}\n`);

const mcpPath = join(repoRoot, "plugin", "mcp.json");
const mcp = mcpSchema.parse(JSON.parse(await readFile(mcpPath, "utf8")));
mcp.mcpServers.transcripts.args = mcp.mcpServers.transcripts.args.map((arg) =>
  arg.startsWith("@stormix/transcripts-mcp@") ? `@stormix/transcripts-mcp@${version}` : arg,
);
await writeFile(mcpPath, `${JSON.stringify(mcp, null, 2)}\n`);

process.stderr.write(`synced plugin version to ${version}\n`);

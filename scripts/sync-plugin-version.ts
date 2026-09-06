import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

const cliPackageSchema = z.object({ name: z.string(), version: z.string() });
const pluginSchema = z
  .object({
    name: z.string(),
    description: z.string(),
    version: z.string(),
    author: z.object({ name: z.string() }),
    keywords: z.array(z.string()),
    license: z.string(),
    logo: z.string(),
    repository: z.string(),
    variables: z
      .object({
        type: z.literal("object"),
        properties: z.record(
          z.string(),
          z.object({ type: z.literal("string"), title: z.string(), description: z.string() }),
        ),
        required: z.array(z.string()),
      })
      .optional(),
  })
  .passthrough();
const mcpSchema = z
  .object({
    mcpServers: z
      .object({
        transcripts: z
          .object({
            command: z.string(),
            args: z.array(z.string()),
            env: z.record(z.string(), z.string()).optional(),
          })
          .passthrough(),
      })
      .passthrough(),
  })
  .passthrough();
const claudePluginSchema = pluginSchema
  .omit({ keywords: true, logo: true, variables: true })
  .extend({ mcpServers: z.string() })
  .passthrough();
const serverSchema = z
  .object({
    $schema: z.string(),
    name: z.string(),
    title: z.string(),
    description: z.string(),
    repository: z.object({ url: z.string(), source: z.string() }).passthrough(),
    version: z.string(),
    websiteUrl: z.string(),
    packages: z.array(
      z
        .object({
          registryType: z.string(),
          registryBaseUrl: z.string(),
          identifier: z.string(),
          version: z.string(),
          transport: z.object({ type: z.string() }).passthrough(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export async function syncVersionMetadata(repoRoot: string, check: boolean): Promise<string[]> {
  const cliPackage = cliPackageSchema.parse(
    JSON.parse(await readFile(join(repoRoot, "packages", "cli", "package.json"), "utf8")),
  );
  const version = cliPackage.version;
  const pinnedPrefix = `${cliPackage.name}@`;
  const outputs = new Map<string, string>();
  const stalePaths = new Set<string>();

  const pluginPath = join(repoRoot, "distribution", "plugin", ".cursor-plugin", "plugin.json");
  const plugin = pluginSchema.parse(JSON.parse(await readFile(pluginPath, "utf8")));
  if (plugin.version !== version) stalePaths.add(pluginPath);
  plugin.version = version;
  outputs.set(pluginPath, serialize(plugin));

  const claudePath = join(repoRoot, "distribution", "plugin", ".claude-plugin", "plugin.json");
  const claudePlugin = claudePluginSchema.parse(JSON.parse(await readFile(claudePath, "utf8")));
  if (claudePlugin.version !== version) stalePaths.add(claudePath);
  claudePlugin.version = version;
  outputs.set(claudePath, serialize(claudePlugin));

  const mcpPath = join(repoRoot, "distribution", "plugin", "mcp.json");
  const mcp = mcpSchema.parse(JSON.parse(await readFile(mcpPath, "utf8")));
  const packageArguments = mcp.mcpServers.transcripts.args.flatMap((arg, index) =>
    arg.startsWith("-") ? [] : [{ arg, index }],
  );
  if (packageArguments.length !== 1) {
    throw new Error(`Expected exactly one package argument in ${relative(repoRoot, mcpPath)}`);
  }
  const packageArgument = packageArguments[0];
  if (packageArgument === undefined) throw new Error("MCP package argument is unavailable");
  const expectedArgs = [...mcp.mcpServers.transcripts.args];
  expectedArgs[packageArgument.index] = `${pinnedPrefix}${version}`;
  if (packageArgument.arg !== `${pinnedPrefix}${version}`) stalePaths.add(mcpPath);
  mcp.mcpServers.transcripts.args = expectedArgs;
  outputs.set(mcpPath, serialize(mcp));

  const serverPath = join(repoRoot, "apps", "www", "public", "server.json");
  const server = serverSchema.parse(JSON.parse(await readFile(serverPath, "utf8")));
  const packageEntries = server.packages.filter(
    (packageEntry) =>
      packageEntry.registryType === "npm" && packageEntry.identifier === cliPackage.name,
  );
  if (packageEntries.length !== 1) {
    throw new Error(`Expected exactly one npm package entry in ${relative(repoRoot, serverPath)}`);
  }
  const serverPackage = packageEntries[0];
  if (serverPackage === undefined) throw new Error("Server package entry is unavailable");
  if (server.version !== version || serverPackage.version !== version) {
    stalePaths.add(serverPath);
  }
  server.version = version;
  serverPackage.version = version;
  outputs.set(serverPath, serialize(server));

  const stale: string[] = [];
  for (const [path, expected] of outputs) {
    if (!stalePaths.has(path)) continue;
    stale.push(relative(repoRoot, path).replaceAll("\\", "/"));
    if (!check) await writeFile(path, expected);
  }
  return stale;
}

function serialize<T>(value: T): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

if (import.meta.main) {
  const check = process.argv.includes("--check");
  const rootArgument = process.argv.find((argument) => argument.startsWith("--root="));
  const repoRoot =
    rootArgument?.slice("--root=".length) ?? join(dirname(fileURLToPath(import.meta.url)), "..");
  const stale = await syncVersionMetadata(repoRoot, check);
  if (check && stale.length > 0) {
    process.stderr.write(`stale version metadata:\n${stale.join("\n")}\n`);
    process.exitCode = 1;
  } else {
    const changed = stale.length > 0 ? ` in ${stale.length} files` : "";
    process.stderr.write(`${check ? "checked" : "synced"} version metadata${changed}\n`);
  }
}

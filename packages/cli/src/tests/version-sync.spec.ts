import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";

const roots: string[] = [];
const versionSchema = z.object({
  version: z.string(),
  packages: z.array(z.object({ version: z.string() })).optional(),
});
const mcpArgsSchema = z.object({
  mcpServers: z.object({ transcripts: z.object({ args: z.array(z.string()) }) }),
});

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("version metadata sync", () => {
  it("should synchronize all metadata idempotently when versions are stale", async () => {
    const root = await createFixture();
    const tracked = [
      "distribution/plugin/.cursor-plugin/plugin.json",
      "distribution/plugin/.claude-plugin/plugin.json",
      "distribution/plugin/mcp.json",
      "apps/www/public/server.json",
    ];
    const beforeCheck = await readTracked(root, tracked);
    const check = runSync(root, "--check");
    expect(check.status).toBe(1);
    for (const path of tracked) expect(check.stderr).toContain(path);
    expect(await readTracked(root, tracked)).toEqual(beforeCheck);

    expect(runSync(root).status).toBe(0);
    const afterSync = await readTracked(root, tracked);
    expect(runSync(root).status).toBe(0);
    expect(await readTracked(root, tracked)).toEqual(afterSync);
    expect(runSync(root, "--check").status).toBe(0);

    const cursor = versionSchema.parse(JSON.parse(afterSync[0] ?? "null"));
    const claude = versionSchema.parse(JSON.parse(afterSync[1] ?? "null"));
    const mcp = mcpArgsSchema.parse(JSON.parse(afterSync[2] ?? "null"));
    const server = versionSchema.parse(JSON.parse(afterSync[3] ?? "null"));
    expect(cursor.version).toBe("1.2.3");
    expect(claude.version).toBe("1.2.3");
    expect(mcp.mcpServers.transcripts.args).toEqual(["-y", "transcripts-mcp@1.2.3"]);
    expect(server.version).toBe("1.2.3");
    expect(server.packages?.map((entry) => entry.version)).toEqual(["1.2.3"]);
    expect(JSON.parse(afterSync[3] ?? "null")).toMatchObject({ futureField: "preserved" });
  });

  it("should fail clearly when required package metadata is missing", async () => {
    const missingArgumentRoot = await createFixture();
    await writeJson(missingArgumentRoot, "distribution/plugin/mcp.json", {
      mcpServers: { transcripts: { command: "npx", args: ["-y"] } },
    });
    const missingArgument = runSync(missingArgumentRoot, "--check");
    expect(missingArgument.status).toBe(1);
    expect(missingArgument.stderr).toContain("Expected exactly one package argument");

    const missingPackageRoot = await createFixture();
    const serverPath = join(missingPackageRoot, "apps/www/public/server.json");
    const server = JSON.parse(await readFile(serverPath, "utf8"));
    server.packages[0].identifier = "different-package";
    await writeJson(missingPackageRoot, "apps/www/public/server.json", server);
    const missingPackage = runSync(missingPackageRoot, "--check");
    expect(missingPackage.status).toBe(1);
    expect(missingPackage.stderr).toContain("Expected exactly one npm package entry");
  });
});

function runSync(root: string, mode?: "--check") {
  const script = join(import.meta.dirname, "../../../../scripts/sync-plugin-version.ts");
  return spawnSync("bun", [script, `--root=${root}`, ...(mode === undefined ? [] : [mode])], {
    encoding: "utf8",
  });
}

async function readTracked(root: string, paths: string[]): Promise<string[]> {
  return Promise.all(paths.map((path) => readFile(join(root, path), "utf8")));
}

async function createFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "transcripts-version-sync-"));
  roots.push(root);
  for (const directory of [
    "packages/cli",
    "distribution/plugin/.cursor-plugin",
    "distribution/plugin/.claude-plugin",
    "apps/www/public",
  ]) {
    await mkdir(join(root, directory), { recursive: true });
  }
  await writeJson(root, "packages/cli/package.json", { name: "transcripts-mcp", version: "1.2.3" });
  const plugin = {
    name: "transcripts-mcp",
    description: "fixture",
    version: "0.0.1",
    author: { name: "Fixture" },
    keywords: ["fixture"],
    license: "MIT",
    logo: "logo.svg",
    repository: "https://example.com/repo",
  };
  await writeJson(root, "distribution/plugin/.cursor-plugin/plugin.json", plugin);
  const { keywords: _keywords, logo: _logo, ...claude } = plugin;
  await writeJson(root, "distribution/plugin/.claude-plugin/plugin.json", {
    ...claude,
    mcpServers: "./mcp.json",
  });
  await writeJson(root, "distribution/plugin/mcp.json", {
    mcpServers: { transcripts: { command: "npx", args: ["-y", "transcripts-mcp"] } },
  });
  await writeJson(root, "apps/www/public/server.json", {
    $schema: "https://example.com/schema.json",
    name: "fixture/server",
    title: "Fixture",
    description: "fixture",
    repository: { url: "https://example.com/repo", source: "github" },
    version: "0.0.1",
    websiteUrl: "https://example.com",
    packages: [
      {
        registryType: "npm",
        registryBaseUrl: "https://registry.npmjs.org",
        identifier: "transcripts-mcp",
        version: "0.0.2",
        transport: { type: "stdio" },
      },
    ],
    futureField: "preserved",
  });
  return root;
}

async function writeJson<T>(root: string, path: string, value: T): Promise<void> {
  await writeFile(join(root, path), `${JSON.stringify(value, null, 2)}\n`);
}

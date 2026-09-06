import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

import { patchZodLazyInit } from "../packages/cli/src/patch-zod-lazy.ts";
import { cliTargets, hostTarget, targetFor, type CliTarget } from "../packages/cli/src/targets.ts";

const packageSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string(),
  license: z.string(),
  repository: z.object({
    type: z.string(),
    url: z.string(),
  }),
  bin: z.record(z.string(), z.string()),
  files: z.array(z.string()),
  type: z.literal("module"),
  publishConfig: z.object({
    registry: z.string(),
    access: z.string(),
  }),
  engines: z.object({
    node: z.string(),
  }),
});

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const cliDir = join(repoRoot, "packages", "cli");
const distDir = join(cliDir, "dist");
const serverEntry = join(repoRoot, "apps", "mcp", "src", "index.ts");
const cliEntry = join(cliDir, "src", "cli.ts");
const smokeEntry = join(cliDir, "src", "tests", "smoke-artifact.ts");
const serverOut = join(distDir, "server.js");
const cliOut = join(distDir, "cli.js");
const smokeOut = join(distDir, "smoke-artifact.js");
const platformsDir = join(distDir, "platforms");

const args = process.argv.slice(2);
const bundleOnly = args.includes("--bundle-only");
const allTargets = args.includes("--all");
const only = onlyTargets(args);

const pkg = packageSchema.parse(JSON.parse(await readFile(join(cliDir, "package.json"), "utf8")));

await mkdir(distDir, { recursive: true });

const bundle = await Bun.$`bun build ${serverEntry} --outfile ${serverOut} --target bun`.text();
process.stderr.write(bundle);
const patched = patchZodLazyInit(await readFile(serverOut, "utf8"));
await writeFile(serverOut, patched);

const cliBundle = await Bun.$`bun build ${cliEntry} --outfile ${cliOut} --target node`.text();
process.stderr.write(cliBundle);
const smokeBundle = await Bun.$`bun build ${smokeEntry} --outfile ${smokeOut} --target node`.text();
process.stderr.write(smokeBundle);
const cliSource = await readFile(cliOut, "utf8");
const shebang = "#!/usr/bin/env node\n";
if (!cliSource.startsWith(shebang)) {
  await writeFile(cliOut, `${shebang}${cliSource}`);
}
await writePublishManifest(pkg);

if (bundleOnly) {
  process.stderr.write("wrote dist/server.js, dist/cli.js, and dist/smoke-artifact.js\n");
  process.exit(0);
}

const targets =
  only ?? (allTargets ? [...cliTargets] : [hostTarget(process.platform, process.arch)]);
await mkdir(platformsDir, { recursive: true });

for (const target of targets) {
  await writePlatformPackage(target, pkg.version);
}

process.stderr.write(`built ${targets.map((target) => target.packageName).join(", ")}\n`);

function onlyTargets(argv: string[]): CliTarget[] | undefined {
  const flag = argv.find((arg) => arg.startsWith("--only="));
  if (flag === undefined) return undefined;
  const id = flag.slice("--only=".length);
  const separator = id.lastIndexOf("-");
  const platform = id.slice(0, separator);
  const arch = id.slice(separator + 1);
  const target = targetFor(platform, arch);
  if (target === undefined) {
    throw new Error(`unknown --only=${id}`);
  }
  return [target];
}

async function writePlatformPackage(target: CliTarget, version: string): Promise<void> {
  const dir = join(platformsDir, `${target.platform}-${target.arch}`);
  await mkdir(dir, { recursive: true });
  const outfile = join(dir, target.binaryFile);
  const compile =
    await Bun.$`bun build --compile --external ${"*/semantic-engine.ts"} --outfile ${outfile} --target ${target.bunTarget} ${serverEntry}`.nothrow();
  if (compile.exitCode !== 0) {
    process.stderr.write(compile.stderr.toString());
    throw new Error(`compile failed for ${target.bunTarget}`);
  }
  process.stderr.write(compile.stderr.toString());
  await writeFile(
    join(dir, "package.json"),
    `${JSON.stringify(
      {
        name: target.packageName,
        version,
        description: `transcripts-mcp ${target.platform}-${target.arch} binary`,
        license: pkg.license,
        os: [target.platform],
        cpu: [target.arch],
        files: [target.binaryFile],
        publishConfig: pkg.publishConfig,
        repository: pkg.repository,
      },
      null,
      2,
    )}\n`,
  );
}

async function writePublishManifest(manifest: z.infer<typeof packageSchema>): Promise<void> {
  const optionalDependencies = Object.fromEntries(
    cliTargets.map((target) => [target.packageName, manifest.version]),
  );
  await writeFile(
    join(distDir, "publish-package.json"),
    `${JSON.stringify({ ...manifest, optionalDependencies }, null, 2)}\n`,
  );
}

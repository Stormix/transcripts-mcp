import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { z } from "zod";

import { hostOptionalBinary, overrideBinaryPath } from "./resolve.ts";
import { hostTarget } from "./targets.ts";

const spawnErrorSchema = z.object({ code: z.string().optional() });

const require = createRequire(import.meta.url);

async function main(): Promise<void> {
  const override = overrideBinaryPath(process.env);
  if (override !== undefined) {
    await runBinary(override);
    return;
  }

  if (process.versions.bun !== undefined) {
    const href = new URL("./server.js", import.meta.url).href;
    await import(href);
    return;
  }

  const installed = hostOptionalBinary(process.platform, process.arch, (specifier) =>
    require.resolve(specifier),
  );
  if (installed !== undefined) {
    await runBinary(installed);
    return;
  }

  const bun = process.platform === "win32" ? "bun.exe" : "bun";
  const server = fileURLToPath(new URL("./server.js", import.meta.url));
  try {
    await runBinary(bun, [server]);
    return;
  } catch (error) {
    const parsed = spawnErrorSchema.safeParse(error);
    if (!parsed.success || parsed.data.code !== "ENOENT") throw error;
  }

  const target = hostTarget(process.platform, process.arch);
  console.error(
    `transcripts-mcp: no ${target.packageName} binary and bun is not on PATH. ` +
      `Install Bun, or install ${target.packageName} from npm.`,
  );
  process.exit(1);
}

function runBinary(command: string, args: string[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    const forward = (signal: NodeJS.Signals) => {
      if (child.killed) return;
      child.kill(signal);
    };
    process.on("SIGINT", forward);
    process.on("SIGTERM", forward);
    child.on("exit", (code, signal) => {
      process.off("SIGINT", forward);
      process.off("SIGTERM", forward);
      if (signal !== null) {
        process.kill(process.pid, signal);
        resolve();
        return;
      }
      process.exit(code ?? 1);
    });
  });
}

void main();

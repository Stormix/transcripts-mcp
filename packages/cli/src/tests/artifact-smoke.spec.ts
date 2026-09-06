import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import { smokeMcpArtifact } from "./smoke-artifact.ts";

const repoRoot = join(import.meta.dirname, "../../../..");
const cliDist = join(repoRoot, "packages", "cli", "dist");

beforeAll(async () => {
  await buildCliArtifacts();
}, 30_000);

describe("release artifact smoke", () => {
  it("should reject the handshake when initialize returns an error", async () => {
    const source =
      "process.stdin.once('data',()=>process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:1,error:{code:-32603,message:'fixture failure'}})+'\\n'));";
    await expect(smokeMcpArtifact(process.execPath, ["--eval", source])).rejects.toThrow(
      "initialize failed: -32603 fixture failure",
    );
  });

  it("should complete an MCP handshake when starting the generated server bundle", async () => {
    const result = await smokeMcpArtifact("bun", [join(cliDist, "server.js")]);
    expect(result.toolNames).toHaveLength(6);
  });

  it("should complete an MCP handshake when starting the generated public CLI", async () => {
    const result = await smokeMcpArtifact(process.execPath, [join(cliDist, "cli.js")]);
    expect(result.toolNames).toHaveLength(6);
  });

  it("should report the child exit code when an artifact crashes before initialization", async () => {
    await expect(smokeMcpArtifact(process.execPath, ["--eval", "process.exit(7)"])).rejects.toThrow(
      "code=7",
    );
  });

  it("should fail clearly when the artifact executable is missing", async () => {
    await expect(smokeMcpArtifact(join(cliDist, "missing-artifact"))).rejects.toThrow();
  });

  it("should leave no child when an unresponsive artifact exits on stdin closure", async () => {
    await expectFixtureStopped(
      "const fs=require('node:fs');fs.writeFileSync(process.argv[1],String(process.pid));process.stdin.resume();process.stdin.on('end',()=>process.exit(0));",
    );
  });

  it("should leave no child when an unresponsive artifact requires termination", async () => {
    await expectFixtureStopped(
      "const fs=require('node:fs');fs.writeFileSync(process.argv[1],String(process.pid));process.stdin.resume();process.stdin.on('end',()=>{});setInterval(()=>{},1000);",
    );
  });
});

async function buildCliArtifacts(): Promise<void> {
  const child = spawn("bun", [join(repoRoot, "scripts", "build-cli.ts"), "--bundle-only"], {
    cwd: repoRoot,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  child.stdin.end();
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk: Buffer) => {
    stdout += chunk.toString("utf8");
  });
  child.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString("utf8");
  });
  const closed = observeBuild(child);
  if (!(await settlesWithin(closed, 25_000))) {
    child.kill("SIGTERM");
    if (!(await settlesWithin(closed, 1_000))) child.kill("SIGKILL");
  }
  if (!(await settlesWithin(closed, 1_000))) throw new Error("CLI build did not terminate");
  const status = await closed;
  if (status.code !== 0) throw new Error(stderr || stdout || "CLI build failed");
}

function observeBuild(child: ChildProcessWithoutNullStreams): Promise<BuildStatus> {
  return new Promise((resolveExit, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => resolveExit({ code, signal }));
  });
}

function settlesWithin(promise: Promise<BuildStatus>, timeoutMs: number): Promise<boolean> {
  return new Promise((resolveResult) => {
    const timer = setTimeout(() => resolveResult(false), timeoutMs);
    promise.then(
      () => {
        clearTimeout(timer);
        return resolveResult(true);
      },
      () => {
        clearTimeout(timer);
        return resolveResult(true);
      },
    );
  });
}

interface BuildStatus {
  code: number | null;
  signal: NodeJS.Signals | null;
}

async function expectFixtureStopped(source: string): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "transcripts-mcp-smoke-fixture-"));
  const pidPath = join(root, "pid");
  try {
    await expect(
      smokeMcpArtifact(process.execPath, ["--eval", source, pidPath], {
        responseTimeoutMs: 1_000,
        gracefulExitMs: 250,
        signalExitMs: 500,
        forcedExitMs: 500,
      }),
    ).rejects.toThrow("Timed out");
    const pid = Number(await readFile(pidPath, "utf8"));
    expect(processIsAlive(pid)).toBe(false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

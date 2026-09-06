import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import { smokeMcpArtifact } from "./smoke-artifact.ts";

const repoRoot = join(import.meta.dirname, "../../../..");
const cliDist = join(repoRoot, "packages", "cli", "dist");

beforeAll(() => {
  const build = spawnSync("bun", [join(repoRoot, "scripts", "build-cli.ts"), "--bundle-only"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (build.status !== 0) throw new Error(build.stderr || build.stdout || "CLI build failed");
}, 30_000);

describe("release artifact smoke", () => {
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

async function expectFixtureStopped(source: string): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "transcripts-mcp-smoke-fixture-"));
  const pidPath = join(root, "pid");
  try {
    await expect(
      smokeMcpArtifact(process.execPath, ["--eval", source, pidPath], {
        responseTimeoutMs: 100,
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

import type { ToolInputContract } from "@transcripts-mcp/contracts";

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { createInterface, type Interface } from "node:readline";
import { fileURLToPath } from "node:url";

import { z } from "zod";

import { toolContractList, toolNames as contractToolNames } from "@transcripts-mcp/contracts";

const defaultSmokeTimeoutMs = 5_000;
const maxCapturedStderrCharacters = 64 * 1024;
const expectedTools = [...contractToolNames].sort();

const responseSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number()]),
  result: z.record(z.string(), z.json()).optional(),
  error: z.object({ code: z.number(), message: z.string() }).optional(),
});
const inputPropertySchema = z
  .object({
    type: z.string().optional(),
    enum: z.array(z.string()).optional(),
    default: z.json().optional(),
    minimum: z.number().optional(),
    maximum: z.number().optional(),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
  })
  .passthrough();
const toolsResultSchema = z.object({
  tools: z.array(
    z.object({
      name: z.string(),
      description: z.string().optional(),
      inputSchema: z
        .object({
          properties: z.record(z.string(), inputPropertySchema),
          required: z.array(z.string()).optional(),
        })
        .passthrough(),
    }),
  ),
});

export interface ArtifactSmokeResult {
  toolNames: string[];
  stderr: string;
}

export interface ArtifactSmokeOptions {
  responseTimeoutMs?: number;
  gracefulExitMs?: number;
  signalExitMs?: number;
  forcedExitMs?: number;
}

interface ChildStatus {
  code: number | null;
  signal: NodeJS.Signals | null;
}

type JsonRpcValue =
  | string
  | number
  | boolean
  | null
  | JsonRpcValue[]
  | { [key: string]: JsonRpcValue };

interface JsonRpcOutbound {
  jsonrpc: "2.0";
  method: string;
  id?: number;
  params?: { [key: string]: JsonRpcValue };
}

export async function smokeMcpArtifact(
  command: string,
  args: readonly string[] = [],
  options: ArtifactSmokeOptions = {},
): Promise<ArtifactSmokeResult> {
  const isolatedRoot = await mkdtemp(join(tmpdir(), "transcripts-mcp-smoke-"));
  let child: ChildProcessWithoutNullStreams | undefined;
  let closed: Promise<ChildStatus> | undefined;
  let lines: Interface | undefined;
  let stderr = "";
  try {
    child = spawn(resolveCommand(command), [...args], {
      env: {
        ...process.env,
        CURSOR_HOME: join(isolatedRoot, "cursor"),
        CLAUDE_HOME: join(isolatedRoot, "claude"),
        CODEX_HOME: join(isolatedRoot, "codex"),
        TRANSCRIPTS_MCP_INDEX: join(isolatedRoot, "index.db"),
      },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = `${stderr}${chunk.toString("utf8")}`.slice(-maxCapturedStderrCharacters);
    });
    closed = observeChild(child);
    lines = createInterface({ input: child.stdout, crlfDelay: Number.POSITIVE_INFINITY });
    const responses = lines[Symbol.asyncIterator]();

    send(child, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "artifact-smoke", version: "1.0.0" },
      },
    });
    const initializeResponse = await nextResponse(
      responses,
      closed,
      1,
      () => stderr,
      options.responseTimeoutMs,
    );
    if (initializeResponse.error !== undefined) {
      throw new Error(
        `initialize failed: ${initializeResponse.error.code} ${initializeResponse.error.message}`,
      );
    }
    if (initializeResponse.result === undefined) {
      throw new Error("initialize failed: missing result");
    }
    send(child, { jsonrpc: "2.0", method: "notifications/initialized" });
    send(child, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    const toolsResponse = await nextResponse(
      responses,
      closed,
      2,
      () => stderr,
      options.responseTimeoutMs,
    );
    if (toolsResponse.error !== undefined) {
      throw new Error(
        `tools/list failed: ${toolsResponse.error.code} ${toolsResponse.error.message}`,
      );
    }
    const tools = toolsResultSchema.parse(toolsResponse.result);
    validateToolContracts(tools.tools);
    const toolNames = tools.tools.map((tool) => tool.name).sort();
    if (toolNames.join("\n") !== expectedTools.join("\n")) {
      throw new Error(`Unexpected MCP tools: ${toolNames.join(", ")}`);
    }
    return { toolNames, stderr };
  } finally {
    lines?.close();
    try {
      if (child !== undefined && closed !== undefined) await terminateChild(child, closed, options);
    } finally {
      await rm(isolatedRoot, { recursive: true, force: true });
    }
  }
}

function validateToolContracts(tools: z.infer<typeof toolsResultSchema>["tools"]): void {
  for (const contract of toolContractList) {
    const tool = tools.find((candidate) => candidate.name === contract.name);
    if (tool === undefined) throw new Error(`Missing MCP tool: ${contract.name}`);
    if (tool.description !== contract.description) {
      throw new Error(`Stale MCP description: ${contract.name}`);
    }
    const expectedNames = Object.keys(contract.inputs).sort();
    const actualNames = Object.keys(tool.inputSchema.properties).sort();
    if (actualNames.join("\n") !== expectedNames.join("\n")) {
      throw new Error(`Stale MCP inputs: ${contract.name}`);
    }
    const expectedRequired = Object.entries(contract.inputs)
      .filter(([, input]) => input.required)
      .map(([name]) => name)
      .sort();
    const actualRequired = [...(tool.inputSchema.required ?? [])].sort();
    if (actualRequired.join("\n") !== expectedRequired.join("\n")) {
      throw new Error(`Stale MCP required inputs: ${contract.name}`);
    }
    for (const [name, input] of Object.entries(contract.inputs)) {
      const property = tool.inputSchema.properties[name];
      if (property === undefined) throw new Error(`Missing MCP input: ${contract.name}.${name}`);
      validateInputContract(property, input, `${contract.name}.${name}`);
    }
  }
}

function validateInputContract(
  property: z.infer<typeof inputPropertySchema>,
  input: ToolInputContract,
  field: string,
): void {
  if (property.type !== input.type) throw new Error(`Stale MCP type: ${field}`);
  assertEqualJson(property.enum, input.values, `enum: ${field}`);
  assertEqualJson(property.default, input.default, `default: ${field}`);
  assertEqualJson(property.minimum, input.minimum, `minimum: ${field}`);
  assertEqualJson(property.maximum, input.maximum, `maximum: ${field}`);
  assertEqualJson(property.minLength, input.minLength, `minLength: ${field}`);
  assertEqualJson(property.maxLength, input.maxLength, `maxLength: ${field}`);
}

function assertEqualJson(
  actual: z.infer<typeof z.json> | undefined,
  expected: z.infer<typeof z.json> | undefined,
  field: string,
): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Stale MCP ${field}`);
}

function resolveCommand(command: string): string {
  if (isAbsolute(command) || command.includes("/") || command.includes("\\")) {
    return resolve(command);
  }
  return command;
}

function send(child: ChildProcessWithoutNullStreams, message: JsonRpcOutbound): void {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}

function observeChild(child: ChildProcessWithoutNullStreams): Promise<ChildStatus> {
  return new Promise((resolveExit, reject) => {
    const cleanup = () => {
      child.off("error", onError);
      child.off("close", onClose);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onClose = (code: number | null, signal: NodeJS.Signals | null) => {
      cleanup();
      resolveExit({ code, signal });
    };
    child.once("error", onError);
    child.once("close", onClose);
  });
}

async function nextResponse(
  responses: AsyncIterator<string>,
  closed: Promise<ChildStatus>,
  id: number,
  readStderr: () => string,
  timeoutMs = defaultSmokeTimeoutMs,
): Promise<z.infer<typeof responseSchema>> {
  return withTimeout(
    (async () => {
      for (;;) {
        const next = await Promise.race([
          responses.next(),
          closed.then(({ code, signal }) => {
            throw new Error(
              `Artifact exited before response ${id}: code=${String(code)} signal=${String(signal)} stderr=${readStderr()}`,
            );
          }),
        ]);
        if (next.done) {
          const { code, signal } = await closed;
          throw new Error(
            `Artifact exited before response ${id}: code=${String(code)} signal=${String(signal)} stderr=${readStderr()}`,
          );
        }
        const parsed = responseSchema.parse(JSON.parse(next.value));
        if (parsed.id === id) return parsed;
      }
    })(),
    `Timed out waiting for MCP response ${id}`,
    timeoutMs,
  );
}

function withTimeout<T>(promise: Promise<T>, message: string, timeoutMs: number): Promise<T> {
  return new Promise((resolveResult, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        return resolveResult(value);
      },
      (error: Error) => {
        clearTimeout(timer);
        return reject(error);
      },
    );
  });
}

async function terminateChild(
  child: ChildProcessWithoutNullStreams,
  closed: Promise<ChildStatus>,
  options: ArtifactSmokeOptions,
): Promise<void> {
  child.stdin.end();
  if (await settlesWithin(closed, options.gracefulExitMs ?? 250)) return;
  child.kill("SIGTERM");
  if (await settlesWithin(closed, options.signalExitMs ?? 750)) return;
  child.kill("SIGKILL");
  if (!(await settlesWithin(closed, options.forcedExitMs ?? 1_000))) {
    throw new Error("Artifact did not close after forced termination");
  }
}

function settlesWithin(promise: Promise<ChildStatus>, timeoutMs: number): Promise<boolean> {
  return new Promise((resolveResult) => {
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      resolveResult(false);
    }, timeoutMs);
    promise.then(
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        return resolveResult(true);
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        return resolveResult(true);
      },
    );
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const command = process.argv[2];
  if (command === undefined) throw new Error("Usage: smoke-artifact <command> [...args]");
  const result = await smokeMcpArtifact(command, process.argv.slice(3));
  console.info(`MCP_SMOKE_OK:${result.toolNames.join(",")}`);
}

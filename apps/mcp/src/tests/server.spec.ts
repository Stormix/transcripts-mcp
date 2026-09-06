import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { McpServer } from "@modelcontextprotocol/server";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { toolNames } from "@transcripts-mcp/contracts";
import { createRegistry, defineJsonlAdapter } from "@transcripts-mcp/core";
import { IndexRebuildRequiredError } from "@transcripts-mcp/search/errors";
import { grepTranscripts } from "@transcripts-mcp/search/grep";

import { getTranscript } from "../tools/get-transcript.ts";
import { listProviders } from "../tools/list-providers.ts";
import { listSessions, registerListSessions } from "../tools/list-sessions.ts";
import { runTool } from "../utils.ts";

const lineSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  text: z.string(),
});

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("createServer", () => {
  it("should return tool errors when indexed search dates are invalid", () => {
    const result = spawnSync(
      "bun",
      ["--bun", join(import.meta.dirname, "search-date-validation.harness.ts")],
      { encoding: "utf8" },
    );
    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(result.stdout).toContain("SEARCH_DATE_VALIDATION_OK");
  });

  it("should expose the six transcript tools when the server is wired", () => {
    const registry = createRegistry();
    const server = new McpServer({ name: "transcripts-mcp", version: "0.0.0" });
    registerListSessions(server, registry);
    expect(server).toBeInstanceOf(McpServer);
    expect(toolNames).toEqual([
      "list_providers",
      "list_sessions",
      "get_transcript",
      "grep_transcripts",
      "search_transcripts",
      "build_index",
    ]);
  });

  it("should return a session summary when list_sessions is invoked with a fake registry", async () => {
    const { registry, sessionId } = await createFakeRegistry();
    const sessions = await listSessions(registry, { limit: 10 });
    expect(sessions).toHaveLength(1);
    const session = sessions[0];
    expect(session?.id).toBe(sessionId);
    expect(session?.provider).toBe("fake");
    expect(session?.title).toBe("hello from user");
  });

  it("should cap messages when get_transcript exceeds the limit", async () => {
    const { registry, sessionId } = await createFakeRegistry();
    const session = await getTranscript(registry, {
      provider: "fake",
      id: sessionId,
      limit: 1,
    });
    expect(session.messages).toHaveLength(1);
    expect(session.messageCount).toBe(2);
    expect(session.messages[0]?.text).toBe("hello from user");
  });

  it("should surface invalid fallback regexes as tool errors", async () => {
    const { registry } = await createFakeRegistry();
    const result = await runTool(() => grepTranscripts(registry, { query: "[", mode: "regex" }));
    expect(result).toMatchObject({ isError: true });
    expect(result.content[0]?.text).toContain("Invalid regex");
  });

  it("should preserve structured index recovery errors", async () => {
    const result = await runTool(() => Promise.reject(new IndexRebuildRequiredError(3)));
    expect(result).toMatchObject({ isError: true });
    expect(JSON.parse(result.content[0]?.text ?? "null")).toEqual({
      code: "INDEX_REBUILD_REQUIRED",
      message: "The local search index was created by an incompatible server version.",
      actualSchemaVersion: 3,
      expectedSchemaVersion: 4,
      recovery: { tool: "build_index", arguments: { full: true } },
    });
  });

  it("should redact raw database errors and arbitrary thrown values", async () => {
    const databaseError = new Error("SQLITE_ERROR: secret query text");
    Object.assign(databaseError, { code: "SQLITE_ERROR" });
    const redacted = await runTool(() => Promise.reject(databaseError));
    expect(redacted.content[0]?.text).toBe("local index database error");

    const arbitrary = await runTool(() => Promise.reject({ message: "secret thrown value" }));
    expect(arbitrary.content[0]?.text).toBe("unknown error");
  });

  it("should report availability and a session count when list_providers walks a fake root", async () => {
    const { registry } = await createFakeRegistry();
    const providers = await listProviders(registry);
    expect(providers).toEqual([
      {
        id: "fake",
        displayName: "Fake",
        available: true,
        sessionCount: 1,
      },
    ]);
  });
});

async function createFakeRegistry() {
  const root = await mkdtemp(join(tmpdir(), "transcripts-mcp-"));
  roots.push(root);

  const sessionId = "sess-1";
  await writeFile(
    join(root, `${sessionId}.jsonl`),
    `${JSON.stringify({ role: "user", text: "hello from user" })}\n${JSON.stringify({ role: "assistant", text: "reply from assistant" })}\n`,
  );

  const adapter = defineJsonlAdapter({
    id: "fake",
    displayName: "Fake",
    root: () => root,
    sessionFiles: "*.jsonl",
    sessionIdFromPath: (filePath) => basename(filePath, ".jsonl"),
    lineSchema,
    toMessage: (line) => ({ role: line.role, text: line.text }),
    titleFromLine: (line) => line.text,
  });

  return { registry: createRegistry([adapter]), sessionId };
}

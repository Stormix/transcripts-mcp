import type { TranscriptAdapter } from "@transcripts-mcp/core";

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createClaudeCodeAdapter } from "../claude-code.ts";
import { createCodexAdapter } from "../codex.ts";
import { createCursorAdapter } from "../cursor.ts";

interface MappingFixture {
  adapter: TranscriptAdapter;
  provider: string;
  sessionId: string;
  filePath: string;
  lines: string[];
}

describe("raw transcript line mapping", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it.each(["cursor", "claude-code", "codex"])(
    "should map skipped records and normalized positions when parsing %s transcripts",
    async (provider) => {
      const root = await mkdtemp(join(tmpdir(), `transcripts-${provider}-mapping-`));
      tempDirs.push(root);
      const fixture = createMappingFixture(provider, root);
      await mkdir(dirname(fixture.filePath), { recursive: true });
      await writeFile(fixture.filePath, `${fixture.lines.join("\n")}\n`);

      let normalizedPosition = 0;
      const mapping = fixture.lines.map((line, index) => {
        const parseError = isInvalidJson(line);
        const message = fixture.adapter.parseRawLine(line);
        if (message === null) {
          return { rawLine: index + 1, normalizedPosition: null, parseError };
        }
        const mapped = { rawLine: index + 1, normalizedPosition, parseError };
        normalizedPosition += 1;
        return mapped;
      });

      expect(mapping).toEqual([
        { rawLine: 1, normalizedPosition: null, parseError: false },
        { rawLine: 2, normalizedPosition: null, parseError: true },
        { rawLine: 3, normalizedPosition: null, parseError: false },
        { rawLine: 4, normalizedPosition: null, parseError: false },
        { rawLine: 5, normalizedPosition: 0, parseError: false },
      ]);

      const session = await fixture.adapter.readSession({
        provider: fixture.provider,
        id: fixture.sessionId,
        path: fixture.filePath,
      });
      expect(session.messages.map((message) => message.text)).toEqual([`${provider} anchor`]);
      expect(session.messageCount).toBe(1);
      expect(session.parseErrors).toBe(1);
    },
  );
});

function createMappingFixture(provider: string, root: string): MappingFixture {
  switch (provider) {
    case "cursor": {
      const sessionId = "cursor-mapping";
      return {
        adapter: createCursorAdapter(root),
        provider,
        sessionId,
        filePath: join(
          root,
          "projects",
          "demo",
          "agent-transcripts",
          sessionId,
          `${sessionId}.jsonl`,
        ),
        lines: [
          JSON.stringify({ kind: "envelope" }),
          "{",
          JSON.stringify({
            role: "assistant",
            message: { content: [{ type: "tool_result", text: "ignored" }] },
          }),
          JSON.stringify({ role: "user", message: { content: "" } }),
          JSON.stringify({ role: "user", message: { content: "cursor anchor" } }),
        ],
      };
    }
    case "claude-code": {
      const sessionId = "claude-mapping";
      return {
        adapter: createClaudeCodeAdapter(root),
        provider,
        sessionId,
        filePath: join(root, "projects", "demo", `${sessionId}.jsonl`),
        lines: [
          JSON.stringify({ type: "queue-operation", operation: "enqueue" }),
          "{",
          JSON.stringify({
            type: "assistant",
            message: {
              role: "assistant",
              content: [{ type: "tool_result", text: "ignored" }],
            },
          }),
          JSON.stringify({ type: "user", message: { role: "user", content: "" } }),
          JSON.stringify({
            type: "user",
            message: { role: "user", content: "claude-code anchor" },
          }),
        ],
      };
    }
    case "codex": {
      const sessionId = "11111111-2222-4333-8444-555555555555";
      return {
        adapter: createCodexAdapter(root),
        provider,
        sessionId,
        filePath: join(
          root,
          "sessions",
          "2026",
          "09",
          "06",
          `rollout-2026-09-06T12-00-00-${sessionId}.jsonl`,
        ),
        lines: [
          JSON.stringify({ type: "session_meta", payload: { session_id: sessionId } }),
          "{",
          JSON.stringify({
            type: "response_item",
            payload: {
              role: "assistant",
              content: [{ type: "tool_result", text: "ignored" }],
            },
          }),
          JSON.stringify({
            type: "response_item",
            payload: { role: "user", content: [{ type: "input_text", text: "" }] },
          }),
          JSON.stringify({
            type: "response_item",
            payload: {
              role: "user",
              content: [{ type: "input_text", text: "codex anchor" }],
            },
          }),
        ],
      };
    }
    default:
      throw new Error(`Unsupported mapping fixture provider: ${provider}`);
  }
}

function isInvalidJson(line: string): boolean {
  try {
    JSON.parse(line);
    return false;
  } catch {
    return true;
  }
}

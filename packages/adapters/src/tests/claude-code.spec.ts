import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { claudeCodeAdapter, createClaudeCodeAdapter } from "../claude-code.ts";

const fixtureRoot = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "claude-code");
const sessionId = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";
const fixturePath = join(fixtureRoot, "projects", "demo-slug", `${sessionId}.jsonl`);

describe("claude-code adapter", () => {
  it("should produce a user message when parsing a conversational fixture line", async () => {
    const lines = (await readFile(fixturePath, "utf8")).split("\n");
    const userLine = lines[1];
    expect(userLine).toBeDefined();
    const message = claudeCodeAdapter.parseRawLine(userLine ?? "");
    expect(message?.role).toBe("user");
    expect(message?.text).toBe("hello world");
    expect(message?.timestamp?.toISOString()).toBe("2026-08-16T15:16:16.745Z");
  });

  it("should skip unrecognized lines when the envelope does not match", () => {
    expect(
      claudeCodeAdapter.parseRawLine(
        `{"type":"queue-operation","operation":"enqueue","sessionId":"${sessionId}"}`,
      ),
    ).toBeNull();
    expect(claudeCodeAdapter.parseRawLine(`{"type":"attachment"}`)).toBeNull();
  });

  it("should return a stable session id when given a session path", () => {
    expect(claudeCodeAdapter.sessionIdFromPath(fixturePath)).toBe(sessionId);
    expect(
      claudeCodeAdapter.sessionIdFromPath(
        "C:/Users/me/.claude/projects/demo-slug/sess-claude.jsonl",
      ),
    ).toBe("sess-claude");
  });

  it("should skip unrecognized lines when reading a fixture session", async () => {
    const adapter = createClaudeCodeAdapter(fixtureRoot);
    const session = await adapter.readSession({ provider: "claude-code", id: sessionId });
    expect(session.messages.map((message) => message.text)).toEqual(["hello world", "hello world"]);
    expect(session.cwd).toBe("/tmp/demo");
    expect(session.parseErrors).toBe(0);
  });

  it("should list the session when filtering by a cwd that only appears on a later line", async () => {
    const adapter = createClaudeCodeAdapter(fixtureRoot);
    const sessions: Array<{ id: string; cwd?: string }> = [];
    for await (const summary of adapter.listSessions({ cwd: "/tmp/demo" })) {
      sessions.push({ id: summary.id, cwd: summary.cwd });
    }
    expect(sessions).toEqual([{ id: sessionId, cwd: "/tmp/demo" }]);
  });
});

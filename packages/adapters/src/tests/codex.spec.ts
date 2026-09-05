import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { codexAdapter, createCodexAdapter } from "../codex.ts";

const fixtureRoot = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "codex");
const sessionId = "cccccccc-dddd-4eee-8fff-000000000000";
const fixturePath = join(
  fixtureRoot,
  "sessions",
  "2026",
  "02",
  "24",
  `rollout-2026-02-24T19-37-48-${sessionId}.jsonl`,
);

describe("codex adapter", () => {
  it("should produce a user message when parsing a conversational fixture line", async () => {
    const lines = (await readFile(fixturePath, "utf8")).split("\n");
    const userLine = lines[1];
    expect(userLine).toBeDefined();
    const message = codexAdapter.parseRawLine(userLine ?? "");
    expect(message?.role).toBe("user");
    expect(message?.text).toBe("hello world");
  });

  it("should skip unrecognized lines when the envelope does not match", () => {
    expect(
      codexAdapter.parseRawLine(
        `{"timestamp":"2026-02-24T18:37:50.000Z","type":"event_msg","payload":{"type":"task_started"}}`,
      ),
    ).toBeNull();
    expect(codexAdapter.parseRawLine(`{"type":"noise"}`)).toBeNull();
  });

  it("should return a stable session id when given a session path", () => {
    expect(codexAdapter.sessionIdFromPath(fixturePath)).toBe(sessionId);
    expect(
      codexAdapter.sessionIdFromPath(
        "C:/Users/me/.codex/sessions/2026/02/24/rollout-2026-02-24T19-37-48-cccccccc-dddd-4eee-8fff-000000000000.jsonl",
      ),
    ).toBe(sessionId);
  });

  it("should skip unrecognized lines when reading a fixture session", async () => {
    const adapter = createCodexAdapter(fixtureRoot);
    const session = await adapter.readSession({ provider: "codex", id: sessionId });
    expect(session.id).toBe(sessionId);
    expect(session.cwd).toBe("/tmp/demo");
    expect(session.messages).toEqual([
      {
        role: "user",
        text: "hello world",
        timestamp: new Date("2026-02-24T18:37:49.000Z"),
      },
      {
        role: "system",
        text: "hello world",
        timestamp: new Date("2026-02-24T18:37:51.000Z"),
      },
    ]);
    expect(session.parseErrors).toBe(0);
  });
});

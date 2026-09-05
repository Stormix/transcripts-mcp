import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createCursorAdapter, cursorAdapter } from "../cursor.ts";

const fixtureRoot = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "cursor");
const sessionId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const fixturePath = join(
  fixtureRoot,
  "projects",
  "demo",
  "agent-transcripts",
  sessionId,
  `${sessionId}.jsonl`,
);

describe("cursor adapter", () => {
  it("should produce a user message when parsing a conversational fixture line", async () => {
    const [firstLine] = (await readFile(fixturePath, "utf8")).split("\n");
    expect(firstLine).toBeDefined();
    const message = cursorAdapter.parseRawLine(firstLine ?? "");
    expect(message).toEqual({
      role: "user",
      text: "hello world",
    });
  });

  it("should skip unrecognized lines when the envelope does not match", () => {
    expect(cursorAdapter.parseRawLine(`{"kind":"unrecognized","payload":{}}`)).toBeNull();
    expect(cursorAdapter.parseRawLine("not json")).toBeNull();
  });

  it("should return a stable session id when given a session path", () => {
    expect(cursorAdapter.sessionIdFromPath(fixturePath)).toBe(sessionId);
    expect(
      cursorAdapter.sessionIdFromPath(
        "C:/Users/me/.cursor/projects/demo/agent-transcripts/sess-1/sess-1.jsonl",
      ),
    ).toBe("sess-1");
  });

  it("should skip unrecognized lines when reading a fixture session", async () => {
    const adapter = createCursorAdapter(fixtureRoot);
    const session = await adapter.readSession({ provider: "cursor", id: sessionId });
    expect(session.messages.map((message) => message.text)).toEqual(["hello world", "hello world"]);
    expect(session.parseErrors).toBe(0);
  });
});

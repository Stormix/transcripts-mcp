import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { createCursorAdapter, cursorAdapter, cursorProjectSlugFromPath } from "../cursor.ts";

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
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

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
    expect(session.projectSlug).toBe("demo");
  });

  it("should derive a project slug from a Cursor session path", () => {
    expect(cursorProjectSlugFromPath(fixturePath)).toBe("demo");
    expect(
      cursorProjectSlugFromPath(
        "C:\\Users\\me\\.cursor\\projects\\v-dev-transcripts-mcp\\agent-transcripts\\sess-1\\sess-1.jsonl",
      ),
    ).toBe("v-dev-transcripts-mcp");
  });

  it("should list a session when the cwd filter matches the project slug", async () => {
    const adapter = createCursorAdapter(fixtureRoot);
    const sessions: Array<{ id: string; title?: string; projectSlug?: string }> = [];
    for await (const summary of adapter.listSessions({ cwd: "demo" })) {
      sessions.push({ id: summary.id, title: summary.title, projectSlug: summary.projectSlug });
    }
    expect(sessions).toEqual([{ id: sessionId, title: "hello world", projectSlug: "demo" }]);
  });

  it("should strip wrapper tags when titling a wrapped user_query", async () => {
    const root = await mkdtemp(join(tmpdir(), "transcripts-cursor-"));
    tempDirs.push(root);
    const wrappedId = "11111111-2222-4333-8444-555555555555";
    const sessionDir = join(root, "projects", "v-dev-demo", "agent-transcripts", wrappedId);
    await mkdir(sessionDir, { recursive: true });
    await writeFile(
      join(sessionDir, `${wrappedId}.jsonl`),
      `${JSON.stringify({
        role: "user",
        message: {
          content: [
            {
              type: "text",
              text: "<timestamp>Saturday, Sep 5, 2026, 10:02 PM (UTC+2)</timestamp>\n<user_query>\nIt would be nice to have a benchmark\n</user_query>",
            },
          ],
        },
      })}\n`,
    );
    const adapter = createCursorAdapter(root);
    const session = await adapter.readSession({ provider: "cursor", id: wrappedId });
    expect(session.title).toBe("It would be nice to have a benchmark");
    expect(session.projectSlug).toBe("v-dev-demo");
  });
});

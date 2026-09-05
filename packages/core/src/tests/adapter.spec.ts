import { mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createTestAdapter } from "./test-adapter";

const fixturesDir = join(import.meta.dirname, "fixtures");

describe("defineJsonlAdapter", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function createTempDir(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), "transcripts-core-"));
    tempDirs.push(dir);
    return dir;
  }

  it("should skip unrecognized lines when safeParse fails", async () => {
    const adapter = createTestAdapter(fixturesDir);
    const session = await adapter.readSession({
      provider: "test",
      id: "skip-unrecognized",
    });

    expect(session.parseErrors).toBe(0);
    expect(session.messages).toEqual([
      { role: "user", text: "hello from user" },
      { role: "assistant", text: "reply from assistant" },
    ]);
  });

  it("should increment parseErrors when a line is not valid JSON", async () => {
    const root = await createTempDir();
    await writeFile(
      join(root, "broken.jsonl"),
      `${JSON.stringify({ type: "msg", text: "before", role: "user" })}\n{not json\n${JSON.stringify({ type: "msg", text: "after", role: "assistant" })}\n`,
    );
    const adapter = createTestAdapter(root);
    const session = await adapter.readSession({ provider: "test", id: "broken" });
    expect(session.parseErrors).toBe(1);
    expect(session.messages.map((message) => message.text)).toEqual(["before", "after"]);
  });

  it("should increment parseErrors when toMessage throws", async () => {
    const adapter = createTestAdapter(fixturesDir);
    const session = await adapter.readSession({
      provider: "test",
      id: "parse-errors",
    });

    expect(session.parseErrors).toBe(1);
    expect(session.messages).toEqual([
      { role: "user", text: "keep this" },
      { role: "assistant", text: "still keep this" },
    ]);
  });

  it("should list sessions newest-first without reading entire files", async () => {
    const root = await createTempDir();
    const newestPath = join(root, "newest.jsonl");
    const middlePath = join(root, "middle.jsonl");
    const oldestPath = join(root, "oldest.jsonl");

    await writeFile(
      newestPath,
      `${JSON.stringify({ type: "msg", text: "newest", role: "user", title: "Newest" })}\n`,
    );
    await writeFile(
      middlePath,
      `${JSON.stringify({ type: "msg", text: "middle", role: "user", title: "Middle" })}\n`,
    );

    const bulk: string[] = [
      JSON.stringify({ type: "msg", text: "oldest first", role: "user", title: "Oldest" }),
    ];
    for (let index = 0; index < 4000; index += 1) {
      bulk.push(JSON.stringify({ type: "msg", text: `bulk-${index}`, role: "assistant" }));
    }
    bulk.push(JSON.stringify({ type: "msg", text: "oldest last", role: "assistant" }));
    await writeFile(oldestPath, `${bulk.join("\n")}\n`);

    const newestTime = new Date("2026-03-01T00:00:00.000Z");
    const middleTime = new Date("2026-02-01T00:00:00.000Z");
    const oldestTime = new Date("2026-01-01T00:00:00.000Z");
    await utimes(newestPath, newestTime, newestTime);
    await utimes(middlePath, middleTime, middleTime);
    await utimes(oldestPath, oldestTime, oldestTime);

    const adapter = createTestAdapter(root);
    const sessions: Array<{ id: string; title?: string; messageCount: number }> = [];
    for await (const summary of adapter.listSessions({ limit: 2 })) {
      sessions.push({
        id: summary.id,
        title: summary.title,
        messageCount: summary.messageCount,
      });
    }

    expect(sessions).toEqual([
      { id: "newest", title: "Newest", messageCount: 0 },
      { id: "middle", title: "Middle", messageCount: 0 },
    ]);
  });

  it("should return null from parseRawLine when the line is not a message", () => {
    const adapter = createTestAdapter(fixturesDir);
    expect(adapter.parseRawLine(`{"type":"system_event","event":"noise"}`)).toBeNull();
    expect(adapter.parseRawLine(`{"type":"msg","text":"","role":"user"}`)).toBeNull();
    expect(adapter.parseRawLine(`{"type":"msg","text":"THROW","role":"assistant"}`)).toBeNull();
    expect(adapter.parseRawLine("not json")).toBeNull();
    expect(adapter.parseRawLine(`{"type":"msg","text":"hello","role":"user"}`)).toEqual({
      role: "user",
      text: "hello",
    });
  });
});

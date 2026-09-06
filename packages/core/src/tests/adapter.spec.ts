import { mkdir, mkdtemp, realpath, rm, symlink, utimes, writeFile } from "node:fs/promises";
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

  async function writeEnvelopeSession(root: string, id: string): Promise<void> {
    await writeFile(
      join(root, `${id}.jsonl`),
      `${[
        JSON.stringify({ type: "queue-operation" }),
        JSON.stringify({
          type: "msg",
          text: "hello",
          role: "user",
          title: "Hello",
          cwd: "/tmp/demo",
          timestamp: "2026-08-16T15:16:16.745Z",
        }),
        JSON.stringify({ type: "attachment" }),
      ].join("\n")}\n`,
    );
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

  it("should reject an explicit path when the file is outside the session glob", async () => {
    const root = await createTempDir();
    const sessionDirectory = join(root, "sessions");
    await mkdir(sessionDirectory);
    const sessionPath = join(root, "outside-glob.jsonl");
    await writeFile(
      sessionPath,
      `${JSON.stringify({ type: "msg", text: "secret", role: "user" })}\n`,
    );
    const adapter = createTestAdapter(root, "sessions/*.jsonl");

    await expect(
      adapter.readSession({ provider: "test", id: "outside-glob", path: sessionPath }),
    ).rejects.toThrow("Session path does not match adapter session files");
  });

  it("should reject an explicit path when the session id does not match", async () => {
    const root = await createTempDir();
    const sessionPath = join(root, "actual.jsonl");
    await writeFile(
      sessionPath,
      `${JSON.stringify({ type: "msg", text: "hello", role: "user" })}\n`,
    );
    const adapter = createTestAdapter(root);

    await expect(
      adapter.readSession({ provider: "test", id: "different", path: sessionPath }),
    ).rejects.toThrow("Session id does not match session path");
  });

  it("should read a session when the explicit path is valid", async () => {
    const root = await createTempDir();
    const sessionPath = join(root, "explicit.jsonl");
    await writeFile(
      sessionPath,
      `${JSON.stringify({ type: "msg", text: "hello", role: "user" })}\n`,
    );
    const adapter = createTestAdapter(root);

    const session = await adapter.readSession({
      provider: "test",
      id: "explicit",
      path: sessionPath,
    });

    expect(session.path).toBe(await realpath(sessionPath));
    expect(session.messages.map((message) => message.text)).toEqual(["hello"]);
  });

  it("should reject an explicit path when the target is a directory", async () => {
    const root = await createTempDir();
    const directoryPath = join(root, "directory.jsonl");
    await mkdir(directoryPath);
    const adapter = createTestAdapter(root);

    await expect(
      adapter.readSession({ provider: "test", id: "directory", path: directoryPath }),
    ).rejects.toThrow("Session path is not a file");
  });

  it("should reject an explicit path when an in-root symlink targets outside", async ({ skip }) => {
    const root = await createTempDir();
    const outsideRoot = await createTempDir();
    const outsidePath = join(outsideRoot, "escaped.jsonl");
    const linkPath = join(root, "escaped.jsonl");
    await writeFile(
      outsidePath,
      `${JSON.stringify({ type: "msg", text: "secret", role: "user" })}\n`,
    );
    const symlinkError = await symlink(outsidePath, linkPath, "file").then(
      () => undefined,
      (error: NodeJS.ErrnoException) => error,
    );
    if (symlinkError !== undefined) {
      if (symlinkError.code === "EPERM" || symlinkError.code === "EACCES") {
        skip();
        return;
      }
      throw symlinkError;
    }
    const adapter = createTestAdapter(root);

    await expect(
      adapter.readSession({ provider: "test", id: "escaped", path: linkPath }),
    ).rejects.toThrow("Session path is outside adapter root");
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
    const sessions: Array<{ id: string; title?: string; messageCount?: number }> = [];
    for await (const summary of adapter.listSessions({ limit: 2 })) {
      sessions.push({
        id: summary.id,
        title: summary.title,
        messageCount: summary.messageCount,
      });
    }

    expect(sessions).toEqual([
      { id: "newest", title: "Newest" },
      { id: "middle", title: "Middle" },
    ]);
  });

  it("should resolve cwd from a later line when the first line is an envelope", async () => {
    const root = await createTempDir();
    await writeEnvelopeSession(root, "envelope");
    const adapter = createTestAdapter(root);
    const summaries: Array<{ id: string; cwd?: string; title?: string }> = [];
    for await (const summary of adapter.listSessions({ cwd: "/tmp/demo" })) {
      summaries.push({ id: summary.id, cwd: summary.cwd, title: summary.title });
    }
    expect(summaries).toEqual([{ id: "envelope", cwd: "/tmp/demo", title: "Hello" }]);
  });

  it("should agree between listSessions and readSession on cwd and startedAt", async () => {
    const root = await createTempDir();
    await writeEnvelopeSession(root, "envelope");
    const adapter = createTestAdapter(root);
    const summaries: Array<{ cwd?: string; startedAt?: Date }> = [];
    for await (const summary of adapter.listSessions({})) {
      summaries.push({ cwd: summary.cwd, startedAt: summary.startedAt });
    }
    const session = await adapter.readSession({ provider: "test", id: "envelope" });
    expect(summaries).toHaveLength(1);
    expect(summaries[0]?.cwd).toBe(session.cwd);
    expect(summaries[0]?.startedAt).toEqual(session.startedAt);
    expect(session.cwd).toBe("/tmp/demo");
    expect(session.startedAt?.toISOString()).toBe("2026-08-16T15:16:16.745Z");
  });

  it("should list a session when the cwd filter matches a project slug", async () => {
    const root = await createTempDir();
    const sessionDir = join(root, "projects", "v-dev-demo", "agent-transcripts", "slug-sess");
    await mkdir(sessionDir, { recursive: true });
    await writeFile(
      join(sessionDir, "slug-sess.jsonl"),
      `${JSON.stringify({ type: "msg", text: "hello", role: "user", title: "Hello" })}\n`,
    );
    const adapter = createTestAdapter(root, "projects/*/agent-transcripts/*/*.jsonl", {
      projectSlugFromPath: (filePath) => {
        const parts = filePath.replaceAll("\\", "/").split("/");
        const projectsAt = parts.lastIndexOf("projects");
        return parts[projectsAt + 1];
      },
    });
    const sessions: Array<{ id: string; projectSlug?: string }> = [];
    for await (const summary of adapter.listSessions({ cwd: "V:\\dev\\demo" })) {
      sessions.push({ id: summary.id, projectSlug: summary.projectSlug });
    }
    expect(sessions).toEqual([{ id: "slug-sess", projectSlug: "v-dev-demo" }]);
  });

  it("should return a cwd from cwdFromRawLine when the line carries one", () => {
    const adapter = createTestAdapter(fixturesDir);
    expect(
      adapter.cwdFromRawLine(`{"type":"msg","text":"hello","role":"user","cwd":"/tmp/demo"}`),
    ).toBe("/tmp/demo");
    expect(adapter.cwdFromRawLine(`{"type":"msg","text":"hello","role":"user"}`)).toBeUndefined();
    expect(adapter.cwdFromRawLine("not json")).toBeUndefined();
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

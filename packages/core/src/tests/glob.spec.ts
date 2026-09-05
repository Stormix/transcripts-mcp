import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { globMatches, walkGlob } from "../glob";

describe("glob", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it("should match a windows-separated relative path when the glob uses forward slashes", () => {
    expect(
      globMatches(
        "projects\\demo\\agent-transcripts\\abc\\abc.jsonl",
        "projects/*/agent-transcripts/*/*.jsonl",
      ),
    ).toBe(true);
  });

  it("should yield matching files when walking a nested glob", async () => {
    const root = await mkdtemp(join(tmpdir(), "transcripts-glob-"));
    tempDirs.push(root);
    const nested = join(root, "projects", "demo", "agent-transcripts", "abc");
    await mkdir(nested, { recursive: true });
    const sessionPath = join(nested, "abc.jsonl");
    await writeFile(sessionPath, "{}\n");
    await writeFile(join(nested, "notes.txt"), "skip");

    const found: string[] = [];
    for await (const path of walkGlob(root, "projects/*/agent-transcripts/*/*.jsonl")) {
      found.push(path);
    }
    expect(found).toEqual([sessionPath]);
  });
});

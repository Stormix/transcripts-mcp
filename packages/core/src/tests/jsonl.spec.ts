import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";

import {
  parseJsonLine,
  readFirstJsonlLine,
  readHeadJsonlLines,
  readJsonlLineAt,
  readJsonlLines,
  readJsonlLinesAt,
  readLastJsonlLine,
} from "../jsonl";

const lineSchema = z.object({
  type: z.literal("msg"),
  text: z.string(),
});

describe("jsonl", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function writeTempFile(contents: string): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), "transcripts-jsonl-"));
    tempDirs.push(dir);
    const path = join(dir, "session.jsonl");
    await writeFile(path, contents);
    return path;
  }

  it("should return the parsed value when the line matches the schema", () => {
    const result = parseJsonLine(`{"type":"msg","text":"hello"}`, lineSchema);
    expect(result).toEqual({ ok: true, value: { type: "msg", text: "hello" } });
  });

  it("should return ok false when JSON is invalid or the schema rejects the line", () => {
    expect(parseJsonLine("{", lineSchema)).toEqual({ ok: false, reason: "invalid-json" });
    expect(parseJsonLine(`{"type":"other","text":"hello"}`, lineSchema)).toEqual({
      ok: false,
      reason: "unrecognized",
    });
  });

  it("should return the requested line when the file is jsonl", async () => {
    const path = await writeTempFile("one\n\nthree\n");
    expect(await readJsonlLineAt(path, 1)).toBe("one");
    expect(await readJsonlLineAt(path, 2)).toBe("");
    expect(await readJsonlLineAt(path, 3)).toBe("three");
    expect(await readJsonlLineAt(path, 4)).toBeNull();
  });

  it("should return first and last lines when the file has multiple rows", async () => {
    const path = await writeTempFile("first\nmiddle\nlast\n");
    expect(await readFirstJsonlLine(path)).toBe("first");
    expect(await readLastJsonlLine(path)).toBe("last");
    const lines: string[] = [];
    for await (const line of readJsonlLines(path)) {
      lines.push(line);
    }
    expect(lines).toEqual(["first", "middle", "last"]);
  });

  it("should stop after the requested number of lines when reading a file head", async () => {
    const path = await writeTempFile("first\nmiddle\nlast\n");
    const lines: string[] = [];
    for await (const line of readHeadJsonlLines(path, 2)) {
      lines.push(line);
    }
    expect(lines).toEqual(["first", "middle"]);
  });

  it("should return only the requested lines when reading several line numbers", async () => {
    const path = await writeTempFile("one\ntwo\nthree\nfour\n");
    const lines = await readJsonlLinesAt(path, [2, 4, 9]);
    expect([...lines.entries()]).toEqual([
      [2, "two"],
      [4, "four"],
    ]);
  });
});

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { z } from "zod";

import { createRegistry, defineJsonlAdapter } from "@transcripts-mcp/core";

const lineSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  text: z.string(),
});

export function createFixtureAdapter(root: string) {
  return defineJsonlAdapter({
    id: "fixture",
    displayName: "Fixture",
    root: () => root,
    sessionFiles: "sessions/*.jsonl",
    sessionIdFromPath: (filePath) => basename(filePath, ".jsonl"),
    lineSchema,
    toMessage: (line) => ({ role: line.role, text: line.text }),
  });
}

export function createFixtureRegistry(root: string) {
  return createRegistry([createFixtureAdapter(root)]);
}

export async function createFixtureRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "transcripts-search-"));
  await mkdir(join(root, "sessions"), { recursive: true });
  return root;
}

export async function writeSession(root: string, id: string, lines: string[]): Promise<string> {
  const path = join(root, "sessions", `${id}.jsonl`);
  await writeFile(path, `${lines.join("\n")}\n`);
  return path;
}

export async function writeBulkSessions(
  root: string,
  count: number,
  linesPerSession: number,
): Promise<string[]> {
  const writes: Promise<string>[] = [];
  for (let sessionIndex = 0; sessionIndex < count; sessionIndex += 1) {
    const id = `bulk-${String(sessionIndex).padStart(4, "0")}`;
    const lines: string[] = [];
    for (let lineIndex = 0; lineIndex < linesPerSession; lineIndex += 1) {
      const role = lineIndex % 2 === 0 ? "user" : "assistant";
      const text =
        lineIndex === 0 ? `target phrase in ${id}` : `filler conversation ${id} line ${lineIndex}`;
      lines.push(messageLine(role, text));
    }
    writes.push(writeSession(root, id, lines));
  }
  return Promise.all(writes);
}

export function messageLine(role: "user" | "assistant" | "system", text: string): string {
  return JSON.stringify({ role, text });
}

export async function removeFixtureRoot(root: string): Promise<void> {
  try {
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  } catch (error) {
    const parsed = z.object({ code: z.string() }).safeParse(error);
    if (parsed.success && parsed.data.code === "EBUSY") return;
    throw error;
  }
}

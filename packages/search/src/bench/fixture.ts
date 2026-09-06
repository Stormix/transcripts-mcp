import assert from "node:assert/strict";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { z } from "zod";

import { createRegistry, defineJsonlAdapter } from "@transcripts-mcp/core";

export const sessionCount = 32;
export const linesPerSession = 128;
export const messageCount = sessionCount * linesPerSession;
const lineSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string(),
  cwd: z.string(),
});

export async function createCorpus(root: string) {
  await mkdir(join(root, "sessions"), { recursive: true });
  for (let session = 0; session < sessionCount; session += 1) {
    const lines = [];
    for (let line = 0; line < linesPerSession; line += 1) {
      lines.push(
        JSON.stringify({
          role: line % 2 === 0 ? "user" : "assistant",
          cwd: "/bench/project",
          text: `target message ${session}:${line} ${"Representative transcript text with source snippets and tool output. ".repeat(8)}`,
        }),
      );
    }
    await writeFile(join(root, "sessions", `${session}.jsonl`), `${lines.join("\n")}\n`);
  }
  return createRegistry([
    defineJsonlAdapter({
      id: "benchmark",
      displayName: "Benchmark fixture",
      root: () => root,
      sessionFiles: "sessions/*.jsonl",
      sessionIdFromPath: (path) => basename(path, ".jsonl"),
      lineSchema,
      toMessage: (line) => ({ role: line.role, text: line.text }),
      cwdFromLine: (line) => line.cwd,
    }),
  ]);
}

export async function appendMessage(root: string): Promise<void> {
  await appendFile(
    join(root, "sessions", "0.jsonl"),
    `${JSON.stringify({ role: "user", text: "target appended message", cwd: "/bench/project" })}\n`,
  );
}

export function checkCount(actual: number, expected: number): void {
  assert.equal(actual, expected, `expected ${expected} results, got ${actual}`);
}

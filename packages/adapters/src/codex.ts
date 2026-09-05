import { basename } from "node:path";

import { z } from "zod";

import { defineJsonlAdapter, type Message, type TranscriptAdapter } from "@transcripts-mcp/core";

import {
  contentPartSchema,
  joinedText,
  makeMessage,
  parseIsoDate,
  titleFromText,
  toMessageRole,
} from "./content.ts";
import { codexRoot } from "./roots.ts";

const uuidAtEnd = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export const codexLineSchema = z.object({
  type: z.string(),
  timestamp: z.string().optional(),
  payload: z
    .object({
      type: z.string().optional(),
      role: z.enum(["user", "assistant", "system", "developer"]).optional(),
      content: z.array(contentPartSchema).optional(),
      session_id: z.string().optional(),
      cwd: z.string().optional(),
    })
    .optional(),
});

export type CodexLine = z.infer<typeof codexLineSchema>;

export function codexToMessage(line: CodexLine): Message | null {
  const payload = line.payload;
  if (payload === undefined || payload.role === undefined || payload.content === undefined) {
    return null;
  }
  return makeMessage(
    toMessageRole(payload.role),
    joinedText(payload.content),
    parseIsoDate(line.timestamp),
    undefined,
  );
}

export function sessionIdFromCodexPath(filePath: string): string {
  const base = basename(filePath, ".jsonl");
  const match = uuidAtEnd.exec(base);
  return match?.[1] ?? base;
}

export function createCodexAdapter(rootDir?: string): TranscriptAdapter {
  return defineJsonlAdapter({
    id: "codex",
    displayName: "Codex",
    root: () => rootDir ?? codexRoot(),
    sessionFiles: "sessions/*/*/*/*.jsonl",
    sessionIdFromPath: sessionIdFromCodexPath,
    lineSchema: codexLineSchema,
    toMessage: codexToMessage,
    titleFromLine: (line) => {
      const content = line.payload?.content;
      if (content === undefined) return undefined;
      return titleFromText(joinedText(content));
    },
    cwdFromLine: (line) => line.payload?.cwd,
    timestampFromLine: (line) => parseIsoDate(line.timestamp),
  });
}

export const codexAdapter = createCodexAdapter();

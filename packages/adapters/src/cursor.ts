import { basename } from "node:path";

import { z } from "zod";

import { defineJsonlAdapter, type Message, type TranscriptAdapter } from "@transcripts-mcp/core";

import { contentSchema, firstToolName, joinedText, makeMessage, titleFromText } from "./content.ts";
import { cursorRoot } from "./roots.ts";

export const cursorLineSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  message: z.object({
    content: contentSchema,
  }),
});

export type CursorLine = z.infer<typeof cursorLineSchema>;

export function cursorToMessage(line: CursorLine): Message | null {
  return makeMessage(
    line.role,
    joinedText(line.message.content),
    undefined,
    firstToolName(line.message.content),
  );
}

export function createCursorAdapter(rootDir?: string): TranscriptAdapter {
  return defineJsonlAdapter({
    id: "cursor",
    displayName: "Cursor",
    root: () => rootDir ?? cursorRoot(),
    sessionFiles: "projects/*/agent-transcripts/*/*.jsonl",
    sessionIdFromPath: (filePath) => basename(filePath, ".jsonl"),
    lineSchema: cursorLineSchema,
    toMessage: cursorToMessage,
    titleFromLine: (line) => titleFromText(joinedText(line.message.content)),
  });
}

export const cursorAdapter = createCursorAdapter();

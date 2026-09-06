import { basename } from "node:path";

import { z } from "zod";

import { defineJsonlAdapter, type Message, type TranscriptAdapter } from "@transcripts-mcp/core";

import {
  contentSchema,
  firstToolName,
  joinedText,
  makeMessage,
  titleFromText,
  toMessageRole,
} from "./content.ts";
import { claudeRoot, parseIsoDate } from "./utils.ts";

const claudeCodeLineSchema = z.object({
  type: z.enum(["user", "assistant"]),
  timestamp: z.string().optional(),
  cwd: z.string().optional(),
  sessionId: z.string().optional(),
  message: z.object({
    role: z.enum(["user", "assistant", "system"]).optional(),
    content: contentSchema,
  }),
});

type ClaudeCodeLine = z.infer<typeof claudeCodeLineSchema>;

function claudeCodeToMessage(line: ClaudeCodeLine): Message | null {
  return makeMessage(
    toMessageRole(line.message.role ?? line.type),
    joinedText(line.message.content),
    parseIsoDate(line.timestamp),
    firstToolName(line.message.content),
  );
}

export function createClaudeCodeAdapter(rootDir?: string): TranscriptAdapter {
  return defineJsonlAdapter({
    id: "claude-code",
    displayName: "Claude Code",
    root: () => rootDir ?? claudeRoot(),
    sessionFiles: "projects/*/*.jsonl",
    sessionIdFromPath: (filePath) => basename(filePath, ".jsonl"),
    lineSchema: claudeCodeLineSchema,
    toMessage: claudeCodeToMessage,
    titleFromLine: (line) => titleFromText(joinedText(line.message.content)),
    cwdFromLine: (line) => line.cwd,
    timestampFromLine: (line) => parseIsoDate(line.timestamp),
  });
}

export const claudeCodeAdapter = createClaudeCodeAdapter();

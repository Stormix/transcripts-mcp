import { basename } from "node:path";

import { z } from "zod";

import { defineJsonlAdapter, type Message, type TranscriptAdapter } from "@transcripts-mcp/core";

import { contentSchema, firstToolName, joinedText, makeMessage, titleFromText } from "./content.ts";
import { cursorRoot } from "./utils.ts";

const cursorLineSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  message: z.object({
    content: contentSchema,
  }),
});

type CursorLine = z.infer<typeof cursorLineSchema>;

function cursorToMessage(line: CursorLine): Message | null {
  return makeMessage(
    line.role,
    joinedText(line.message.content),
    undefined,
    firstToolName(line.message.content),
  );
}

export function cursorProjectSlugFromPath(filePath: string): string | undefined {
  const parts = filePath.replaceAll("\\", "/").split("/");
  const projectsAt = parts.lastIndexOf("projects");
  if (projectsAt === -1) return undefined;
  const slug = parts[projectsAt + 1];
  if (slug === undefined || slug.length === 0) return undefined;
  return slug;
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
    projectSlugFromPath: cursorProjectSlugFromPath,
  });
}

export const cursorAdapter = createCursorAdapter();

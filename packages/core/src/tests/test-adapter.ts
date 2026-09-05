import { basename } from "node:path";

import { z } from "zod";

import { defineJsonlAdapter } from "../adapter";
import { roleSchema } from "../types";

export const testLineSchema = z.object({
  type: z.literal("msg"),
  text: z.string(),
  role: roleSchema,
  title: z.string().optional(),
  cwd: z.string().optional(),
  timestamp: z.string().optional(),
});

export function createTestAdapter(
  root: string,
  sessionFiles = "*.jsonl",
  options: { projectSlugFromPath?: (path: string) => string | undefined } = {},
) {
  return defineJsonlAdapter({
    id: "test",
    displayName: "Test",
    root: () => root,
    sessionFiles,
    sessionIdFromPath: (path) => basename(path, ".jsonl"),
    lineSchema: testLineSchema,
    toMessage: (line) => {
      if (line.text === "THROW") throw new Error("toMessage failed");
      if (line.text.length === 0) return null;
      return {
        role: line.role,
        text: line.text,
        timestamp: dateFromIso(line.timestamp),
      };
    },
    titleFromLine: (line) => line.title,
    cwdFromLine: (line) => line.cwd,
    timestampFromLine: (line) => dateFromIso(line.timestamp),
    projectSlugFromPath: options.projectSlugFromPath,
  });
}

function dateFromIso(value: string | undefined): Date | undefined {
  if (value === undefined) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

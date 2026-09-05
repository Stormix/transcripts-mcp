import type { Message, Role } from "@transcripts-mcp/core";

import { z } from "zod";

export const contentPartSchema = z.object({
  type: z.string(),
  text: z.string().optional(),
  thinking: z.string().optional(),
  name: z.string().optional(),
});

export type ContentPart = z.infer<typeof contentPartSchema>;

export const contentSchema = z.union([
  z.string().transform((text): ContentPart[] => [{ type: "text", text }]),
  z.array(contentPartSchema),
]);

const skippedPartTypes = new Set(["tool_result", "tool-result"]);

export function joinedText(parts: readonly ContentPart[]): string {
  const chunks: string[] = [];
  for (const part of parts) {
    if (skippedPartTypes.has(part.type)) continue;
    if (part.text !== undefined) {
      chunks.push(part.text);
      continue;
    }
    if (part.thinking !== undefined) chunks.push(part.thinking);
  }
  return chunks.join("\n");
}

export function firstToolName(parts: readonly ContentPart[]): string | undefined {
  for (const part of parts) {
    if (part.type === "tool_use" && part.name !== undefined) return part.name;
  }
  return undefined;
}

export function toMessageRole(role: "user" | "assistant" | "system" | "tool" | "developer"): Role {
  switch (role) {
    case "developer":
      return "system";
    case "user":
    case "assistant":
    case "system":
    case "tool":
      return role;
    default: {
      const exhaustive: never = role;
      return exhaustive;
    }
  }
}

export function parseIsoDate(value: string | undefined): Date | undefined {
  if (value === undefined) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

const titleWrapperTags = [
  "timestamp",
  "app-context",
  "environment_context",
  "skills_instructions",
  "recommended_plugins",
  "system_reminder",
] as const;

function extractTagInner(text: string, tag: string): string | undefined {
  const open = `<${tag}>`;
  const close = `</${tag}>`;
  const start = text.indexOf(open);
  if (start === -1) return undefined;
  const innerStart = start + open.length;
  const end = text.indexOf(close, innerStart);
  if (end === -1) return undefined;
  return text.slice(innerStart, end);
}

function stripPairedTag(text: string, tag: string): string {
  const open = `<${tag}>`;
  const close = `</${tag}>`;
  let result = text;
  for (;;) {
    const start = result.indexOf(open);
    if (start === -1) break;
    const end = result.indexOf(close, start + open.length);
    if (end === -1) {
      result = `${result.slice(0, start)}${result.slice(start + open.length)}`;
      break;
    }
    result = `${result.slice(0, start)}${result.slice(end + close.length)}`;
  }
  return result;
}

export function cleanTitleText(text: string): string {
  const userQuery = extractTagInner(text, "user_query");
  if (userQuery !== undefined) return userQuery;
  let cleaned = text;
  for (const tag of titleWrapperTags) {
    cleaned = stripPairedTag(cleaned, tag);
  }
  return cleaned.replace(/^(?:\s*<[^>]+>)+/, "");
}

export function titleFromText(text: string): string | undefined {
  const compact = cleanTitleText(text).replace(/\s+/g, " ").trim();
  if (compact.length === 0) return undefined;
  if (compact.length <= 80) return compact;
  return `${compact.slice(0, 77)}...`;
}

export function makeMessage(
  role: Role,
  text: string,
  timestamp: Date | undefined,
  toolName: string | undefined,
): Message | null {
  if (text.length === 0) return null;
  const message: Message = { role, text };
  if (timestamp !== undefined) message.timestamp = timestamp;
  if (toolName !== undefined) message.toolName = toolName;
  return message;
}

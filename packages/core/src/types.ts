import { z } from "zod";

export const roleSchema = z.enum(["user", "assistant", "system", "tool"]);
export type Role = z.infer<typeof roleSchema>;

export const messageSchema = z.object({
  role: roleSchema,
  text: z.string(),
  timestamp: z.date().optional(),
  toolName: z.string().optional(),
});
export type Message = z.infer<typeof messageSchema>;

export const sessionSummarySchema = z.object({
  id: z.string(),
  provider: z.string(),
  title: z.string().optional(),
  cwd: z.string().optional(),
  startedAt: z.date().optional(),
  endedAt: z.date().optional(),
  messageCount: z.number().int().nonnegative(),
  parseErrors: z.number().int().nonnegative(),
  path: z.string(),
  mtime: z.date(),
});
export type SessionSummary = z.infer<typeof sessionSummarySchema>;

export const sessionSchema = sessionSummarySchema.extend({
  messages: z.array(messageSchema),
});
export type Session = z.infer<typeof sessionSchema>;

export const sessionRefSchema = z.object({
  provider: z.string(),
  id: z.string(),
  path: z.string().optional(),
});
export type SessionRef = z.infer<typeof sessionRefSchema>;

export const listOptionsSchema = z.object({
  provider: z.string().optional(),
  cwd: z.string().optional(),
  since: z.date().optional(),
  until: z.date().optional(),
  limit: z.number().int().nonnegative().optional(),
  cursor: z.string().optional(),
});
export type ListOptions = z.infer<typeof listOptionsSchema>;

export const providerInfoSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  available: z.boolean(),
});
export type ProviderInfo = z.infer<typeof providerInfoSchema>;

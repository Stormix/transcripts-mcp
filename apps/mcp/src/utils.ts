import type { AdapterRegistry, TranscriptAdapter } from "@transcripts-mcp/core";

import * as z from "zod/v4";

const caughtSchema = z.object({ message: z.string() });

export function parseIso(value: string | undefined): Date | undefined {
  if (value === undefined) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ISO date: ${value}`);
  }
  return date;
}

export function adaptersFor(
  registry: AdapterRegistry,
  provider: string | undefined,
): TranscriptAdapter[] {
  if (provider === undefined) return registry.list();
  const adapter = registry.get(provider);
  if (adapter === undefined) return [];
  return [adapter];
}

export function requireAdapter(registry: AdapterRegistry, provider: string): TranscriptAdapter {
  const adapter = registry.get(provider);
  if (adapter === undefined) {
    throw new Error(`Unknown provider: ${provider}`);
  }
  return adapter;
}

function jsonResult<T>(value: T) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}

function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

export async function runTool<T>(run: () => Promise<T>) {
  try {
    return jsonResult(await run());
  } catch (error) {
    const parsed = caughtSchema.safeParse(error);
    return errorResult(parsed.success ? parsed.data.message : "unknown error");
  }
}

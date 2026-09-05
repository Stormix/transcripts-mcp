import type { AdapterRegistry, TranscriptAdapter } from "@transcripts-mcp/core";

export function selectedAdapters(
  registry: AdapterRegistry,
  provider: string | undefined,
): TranscriptAdapter[] {
  if (provider === undefined) return registry.list();
  const adapter = registry.get(provider);
  if (adapter === undefined) return [];
  return [adapter];
}

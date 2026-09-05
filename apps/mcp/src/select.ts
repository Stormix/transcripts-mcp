import type { AdapterRegistry, TranscriptAdapter } from "@transcripts-mcp/core";

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

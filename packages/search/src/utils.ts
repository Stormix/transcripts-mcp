import type { AdapterRegistry, TranscriptAdapter } from "@transcripts-mcp/core";

import type { SearchQuery } from "./types.ts";

export function normalizeSearchQueryDates(query: SearchQuery): SearchQuery {
  const since = normalizeSearchDate(query.since);
  const until = normalizeSearchDate(query.until);
  if (since !== undefined && until !== undefined && since > until) {
    throw new Error("Search date range requires since to be before or equal to until");
  }
  return { ...query, since, until };
}

function normalizeSearchDate(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid ISO date: ${value}`);
  return date.toISOString();
}

export function selectedAdapters(
  registry: AdapterRegistry,
  provider: string | undefined,
): TranscriptAdapter[] {
  if (provider === undefined) return registry.list();
  const adapter = registry.get(provider);
  if (adapter === undefined) return [];
  return [adapter];
}

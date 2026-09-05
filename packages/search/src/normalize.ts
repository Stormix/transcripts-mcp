import type { AdapterRegistry } from "@transcripts-mcp/core";

import type { CandidateHit, GrepHit } from "./types.ts";

import { readJsonlLineAt } from "@transcripts-mcp/core";

export async function normalizeHits(
  registry: AdapterRegistry,
  candidates: readonly CandidateHit[],
  limit: number,
): Promise<GrepHit[]> {
  const hits: GrepHit[] = [];
  for (const candidate of candidates) {
    if (hits.length >= limit) break;
    const adapter = registry.resolveByPath(candidate.path);
    if (adapter === undefined) continue;
    const line = await readJsonlLineAt(candidate.path, candidate.lineNumber);
    if (line === null) continue;
    const message = adapter.parseRawLine(line);
    if (message === null) continue;
    hits.push({
      provider: adapter.id,
      sessionId: adapter.sessionIdFromPath(candidate.path),
      path: candidate.path,
      lineNumber: candidate.lineNumber,
      message,
      score: candidate.score,
    });
  }
  return hits;
}

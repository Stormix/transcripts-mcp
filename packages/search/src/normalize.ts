import type { CandidateHit, GrepHit } from "./types.ts";

import { readJsonlLinesAt, type AdapterRegistry } from "@transcripts-mcp/core";

export const candidateWindow = 128;

export type LineReader = (
  path: string,
  lineNumbers: readonly number[],
) => Promise<Map<number, string>>;

export async function normalizeCandidates(
  registry: AdapterRegistry,
  candidates: AsyncIterable<CandidateHit>,
  limit: number,
  readLines: LineReader = readJsonlLinesAt,
): Promise<GrepHit[]> {
  const hits: GrepHit[] = [];
  if (limit < 1) return hits;

  const window: CandidateHit[] = [];
  for await (const candidate of candidates) {
    window.push(candidate);
    if (window.length < candidateWindow) continue;
    await appendAcceptedHits(registry, window, hits, limit, readLines);
    window.length = 0;
    if (hits.length >= limit) return hits;
  }
  if (window.length > 0 && hits.length < limit) {
    await appendAcceptedHits(registry, window, hits, limit, readLines);
  }
  return hits;
}

async function appendAcceptedHits(
  registry: AdapterRegistry,
  window: readonly CandidateHit[],
  hits: GrepHit[],
  limit: number,
  readLines: LineReader,
): Promise<void> {
  const needed = new Map<string, Set<number>>();
  for (const candidate of window) {
    if (registry.resolveByPath(candidate.path) === undefined) continue;
    let lineNumbers = needed.get(candidate.path);
    if (lineNumbers === undefined) {
      lineNumbers = new Set();
      needed.set(candidate.path, lineNumbers);
    }
    lineNumbers.add(candidate.lineNumber);
  }

  const linesByPath = new Map<string, Map<number, string>>();
  for (const [path, lineNumbers] of needed) {
    linesByPath.set(path, await readLines(path, [...lineNumbers]));
  }

  for (const candidate of window) {
    if (hits.length >= limit) return;
    const adapter = registry.resolveByPath(candidate.path);
    if (adapter === undefined) continue;
    const line = linesByPath.get(candidate.path)?.get(candidate.lineNumber);
    if (line === undefined) continue;
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
}

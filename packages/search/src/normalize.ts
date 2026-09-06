import type { CandidateHit, GrepHit } from "./types.ts";

import {
  readJsonlLinesAt,
  readJsonlLinesAtOffsets,
  type AdapterRegistry,
} from "@transcripts-mcp/core";

import { candidateWindow } from "./constants.ts";

export type CandidateLineReader = (
  path: string,
  candidates: readonly CandidateHit[],
) => Promise<Map<number, string>>;

export async function normalizeCandidates(
  registry: AdapterRegistry,
  candidates: AsyncIterable<CandidateHit>,
  limit: number,
  readLines: CandidateLineReader = readCandidateLines,
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
  readLines: CandidateLineReader,
): Promise<void> {
  const needed = new Map<string, CandidateHit[]>();
  for (const candidate of window) {
    if (registry.resolveByPath(candidate.path) === undefined) continue;
    const pathCandidates = needed.get(candidate.path);
    if (pathCandidates === undefined) needed.set(candidate.path, [candidate]);
    else pathCandidates.push(candidate);
  }

  const linesByPath = new Map<string, Map<number, string>>();
  for (const [path, pathCandidates] of needed) {
    linesByPath.set(path, await readLines(path, pathCandidates));
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

async function readCandidateLines(
  path: string,
  candidates: readonly CandidateHit[],
): Promise<Map<number, string>> {
  if (candidates.every((candidate) => candidate.byteOffset !== undefined)) {
    return readJsonlLinesAtOffsets(
      path,
      candidates.flatMap((candidate) =>
        candidate.byteOffset === undefined
          ? []
          : [{ lineNumber: candidate.lineNumber, byteOffset: candidate.byteOffset }],
      ),
    );
  }
  return readJsonlLinesAt(
    path,
    candidates.map((candidate) => candidate.lineNumber),
  );
}

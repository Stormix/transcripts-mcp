import type { AdapterRegistry } from "@transcripts-mcp/core";

import type { CandidateHit, GrepHit, GrepMode, GrepQuery } from "./types.ts";

import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

import { walkGlob } from "@transcripts-mcp/core";

import { normalizeHits } from "./normalize.ts";
import { selectedAdapters } from "./select.ts";

export async function scanGrep(registry: AdapterRegistry, query: GrepQuery): Promise<GrepHit[]> {
  const limit = query.limit ?? 50;
  const candidates = await collectScanCandidates(registry, query, limit * 4);
  return normalizeHits(registry, candidates, limit);
}

export async function collectScanCandidates(
  registry: AdapterRegistry,
  query: GrepQuery,
  cap: number,
): Promise<CandidateHit[]> {
  const mode = query.mode ?? "plain";
  const adapters = selectedAdapters(registry, query.provider);
  const candidates: CandidateHit[] = [];

  for (const adapter of adapters) {
    if (!(await adapter.isAvailable())) continue;
    for await (const filePath of walkGlob(adapter.root(), adapter.sessionFiles)) {
      if (candidates.length >= cap) return candidates;
      await collectFileHits(filePath, query.query, mode, candidates, cap);
    }
  }

  return candidates;
}

export function lineMatches(line: string, query: string, mode: GrepMode): boolean {
  if (mode === "regex") {
    try {
      return new RegExp(query, "i").test(line);
    } catch {
      return false;
    }
  }
  const haystack = line.toLowerCase();
  const needle = query.toLowerCase();
  if (mode === "plain") return haystack.includes(needle);
  return fuzzyIncludes(haystack, needle);
}

function fuzzyIncludes(haystack: string, needle: string): boolean {
  let from = 0;
  for (const char of needle) {
    const at = haystack.indexOf(char, from);
    if (at === -1) return false;
    from = at + 1;
  }
  return needle.length > 0;
}

async function collectFileHits(
  filePath: string,
  query: string,
  mode: GrepMode,
  candidates: CandidateHit[],
  cap: number,
): Promise<void> {
  const stream = createReadStream(filePath, { encoding: "utf8" });
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  let lineNumber = 0;
  try {
    for await (const line of lines) {
      lineNumber += 1;
      if (!lineMatches(line, query, mode)) continue;
      candidates.push({ path: filePath, lineNumber });
      if (candidates.length >= cap) return;
    }
  } finally {
    lines.close();
    stream.destroy();
  }
}

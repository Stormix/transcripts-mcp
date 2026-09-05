import type { AdapterRegistry } from "@transcripts-mcp/core";

import type { CandidateHit, GrepHit, GrepMode, GrepQuery } from "./types.ts";

import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

import { walkGlob } from "@transcripts-mcp/core";

import { normalizeCandidates } from "./normalize.ts";
import { selectedAdapters } from "./select.ts";

export async function scanGrep(registry: AdapterRegistry, query: GrepQuery): Promise<GrepHit[]> {
  const limit = query.limit ?? 50;
  return normalizeCandidates(registry, streamScanCandidates(registry, query), limit);
}

export async function* streamScanCandidates(
  registry: AdapterRegistry,
  query: GrepQuery,
): AsyncIterable<CandidateHit> {
  const mode = query.mode ?? "plain";
  for (const adapter of selectedAdapters(registry, query.provider)) {
    if (!(await adapter.isAvailable())) continue;
    for await (const filePath of walkGlob(adapter.root(), adapter.sessionFiles)) {
      yield* streamFileHits(filePath, query.query, mode);
    }
  }
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

async function* streamFileHits(
  filePath: string,
  query: string,
  mode: GrepMode,
): AsyncIterable<CandidateHit> {
  const stream = createReadStream(filePath, { encoding: "utf8" });
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  let lineNumber = 0;
  try {
    for await (const line of lines) {
      lineNumber += 1;
      if (!lineMatches(line, query, mode)) continue;
      yield { path: filePath, lineNumber };
    }
  } finally {
    lines.close();
    stream.destroy();
  }
}

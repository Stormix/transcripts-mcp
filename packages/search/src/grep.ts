import type { FileFinder } from "@ff-labs/fff-bun";

import type { AdapterRegistry, TranscriptAdapter } from "@transcripts-mcp/core";

import type { CandidateHit, GrepHit, GrepQuery } from "./types.ts";

import { homedir } from "node:os";
import { join, resolve } from "node:path";

import { normalizeHits } from "./normalize.ts";
import { collectScanCandidates, scanGrep } from "./scan.ts";
import { selectedAdapters } from "./select.ts";

const maxFileSizeBytes = 10 * 1024 * 1024;
const scanTimeoutMs = 60_000;

type FileFinderClass = typeof FileFinder;

const finders = new Map<string, FileFinder>();
let nativeFailed = false;
let nativeReady: FileFinderClass | undefined;
let nativeProbe: Promise<FileFinderClass | undefined> | undefined;

export function isGrepAvailable(): boolean {
  return !nativeFailed && nativeReady !== undefined;
}

export async function grepTranscripts(
  registry: AdapterRegistry,
  query: GrepQuery,
): Promise<GrepHit[]> {
  const Finder = await loadFileFinder();
  if (Finder === undefined) return scanGrep(registry, query);

  const limit = query.limit ?? 50;
  const mode = query.mode ?? "plain";
  const candidates: CandidateHit[] = [];

  for (const adapter of selectedAdapters(registry, query.provider)) {
    if (!(await adapter.isAvailable())) continue;
    const finder = await finderFor(adapter, Finder);
    if (finder === undefined) {
      const fallback = await collectScanCandidates(
        registry,
        {
          query: query.query,
          mode: query.mode,
          provider: adapter.id,
          limit,
        },
        limit * 4,
      );
      candidates.push(...fallback);
      continue;
    }

    const result = finder.grep(query.query, {
      mode,
      smartCase: true,
      maxFileSize: maxFileSizeBytes,
      pageSize: limit * 4,
      beforeContext: 0,
      afterContext: 0,
    });
    if (!result.ok) continue;
    for (const item of result.value.items) {
      candidates.push({
        path: join(adapter.root(), item.relativePath),
        lineNumber: item.lineNumber,
        score: item.fuzzyScore,
      });
    }
  }

  return normalizeHits(registry, candidates, limit);
}

async function finderFor(
  adapter: TranscriptAdapter,
  Finder: FileFinderClass,
): Promise<FileFinder | undefined> {
  const cached = finders.get(adapter.id);
  if (cached !== undefined) return cached;
  try {
    if (!Finder.isAvailable()) {
      nativeFailed = true;
      return undefined;
    }
    const root = resolve(adapter.root());
    const created = Finder.create({
      basePath: root,
      enableHomeDirScanning: root === resolve(homedir()),
      aiMode: true,
      cacheBudgetMaxFileSize: maxFileSizeBytes,
    });
    if (!created.ok) return undefined;
    await created.value.waitForScan(scanTimeoutMs);
    finders.set(adapter.id, created.value);
    return created.value;
  } catch (error) {
    nativeFailed = true;
    console.error(`fff unavailable for ${adapter.id}; using streaming grep`, error);
    return undefined;
  }
}

function loadFileFinder(): Promise<FileFinderClass | undefined> {
  if (nativeFailed) return Promise.resolve(undefined);
  if (nativeReady !== undefined) return Promise.resolve(nativeReady);
  nativeProbe ??= import("@ff-labs/fff-bun")
    .then((mod) => {
      if (!mod.FileFinder.isAvailable()) {
        nativeFailed = true;
        return undefined;
      }
      nativeReady = mod.FileFinder;
      return mod.FileFinder;
    })
    .catch((error) => {
      nativeFailed = true;
      console.error("fff native probe failed; using streaming grep", error);
      return undefined;
    });
  return nativeProbe;
}

void loadFileFinder();

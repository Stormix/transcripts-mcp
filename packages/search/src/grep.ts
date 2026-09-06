import type { FileFinder, GrepCursor } from "@ff-labs/fff-bun";

import type { AdapterRegistry, TranscriptAdapter } from "@transcripts-mcp/core";

import type { CandidateHit, GrepHit, GrepQuery } from "./types.ts";

import { homedir } from "node:os";
import { join, resolve } from "node:path";

import { globMatches } from "@transcripts-mcp/core";

import { candidateWindow, defaultHitLimit, maxFileSizeBytes, scanTimeoutMs } from "./constants.ts";
import { normalizeCandidates } from "./normalize.ts";
import { createScanBudget, scanGrep, streamScanCandidates, validateGrepPattern } from "./scan.ts";
import { selectedAdapters } from "./utils.ts";

type FileFinderClass = typeof FileFinder;

const finders = new Map<string, Promise<FileFinder | undefined>>();
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
  validateGrepPattern(query.query, query.mode ?? "plain");

  const limit = query.limit ?? defaultHitLimit;
  return normalizeCandidates(registry, streamNativeCandidates(registry, query, Finder), limit);
}

async function* streamNativeCandidates(
  registry: AdapterRegistry,
  query: GrepQuery,
  Finder: FileFinderClass,
): AsyncIterable<CandidateHit> {
  const mode = query.mode ?? "plain";
  const fallbackBudget = createScanBudget();
  for (const adapter of selectedAdapters(registry, query.provider)) {
    if (!(await adapter.isAvailable())) continue;
    const root = resolve(adapter.root());
    const finder = await finderFor(adapter.id, root, Finder);
    if (finder === undefined) {
      yield* streamScanCandidates(
        registry,
        {
          query: query.query,
          mode: query.mode,
          provider: adapter.id,
        },
        fallbackBudget,
      );
      continue;
    }

    let cursor: GrepCursor | null = null;
    for (;;) {
      const result = finder.grep(query.query, {
        mode,
        smartCase: true,
        maxFileSize: maxFileSizeBytes,
        pageSize: candidateWindow,
        beforeContext: 0,
        afterContext: 0,
        cursor,
      });
      if (!result.ok) break;
      for (const item of result.value.items) {
        if (!isAdapterSessionFile(adapter, item.relativePath)) continue;
        yield {
          path: join(root, item.relativePath),
          lineNumber: item.lineNumber,
          byteOffset: item.byteOffset,
          score: item.fuzzyScore,
        };
      }
      if (result.value.nextCursor === null) break;
      cursor = result.value.nextCursor;
    }
  }
}

export function isAdapterSessionFile(
  adapter: TranscriptAdapter,
  finderRelativePath: string,
): boolean {
  return globMatches(finderRelativePath, adapter.sessionFiles);
}

function finderFor(
  provider: string,
  root: string,
  Finder: FileFinderClass,
): Promise<FileFinder | undefined> {
  const key = JSON.stringify([provider, root]);
  const cached = finders.get(key);
  if (cached !== undefined) return cached;
  const pending = createFinder(provider, root, Finder).then((finder) => {
    if (finder === undefined && finders.get(key) === pending) finders.delete(key);
    return finder;
  });
  finders.set(key, pending);
  return pending;
}

/** Release cached native finders after all grep requests have finished. */
export async function closeGrepFinders(): Promise<void> {
  const pending = [...finders.values()];
  finders.clear();
  for (const finder of pending) (await finder)?.destroy();
}

async function createFinder(
  provider: string,
  root: string,
  Finder: FileFinderClass,
): Promise<FileFinder | undefined> {
  try {
    if (!Finder.isAvailable()) {
      nativeFailed = true;
      return undefined;
    }
    const created = Finder.create({
      basePath: root,
      enableHomeDirScanning: root === resolve(homedir()),
      aiMode: true,
      cacheBudgetMaxFileSize: maxFileSizeBytes,
    });
    if (!created.ok) return undefined;
    try {
      const scanned = await created.value.waitForScan(scanTimeoutMs);
      if (scanned.ok && scanned.value) return created.value;
    } catch (error) {
      created.value.destroy();
      throw error;
    }
    created.value.destroy();
    return undefined;
  } catch (error) {
    nativeFailed = true;
    console.error(`fff unavailable for ${provider}; using streaming grep`, error);
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

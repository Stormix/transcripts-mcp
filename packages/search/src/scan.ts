import type { AdapterRegistry } from "@transcripts-mcp/core";

import type { CandidateHit, GrepHit, GrepMode, GrepQuery } from "./types.ts";

import { open, stat } from "node:fs/promises";
import { performance } from "node:perf_hooks";

import { walkGlob } from "@transcripts-mcp/core";

import {
  defaultHitLimit,
  maxFileSizeBytes,
  maxGrepLineBytes,
  maxGrepPatternLength,
  maxScanBytes,
  scanTimeoutMs,
} from "./constants.ts";
import { normalizeCandidates } from "./normalize.ts";
import { selectedAdapters } from "./utils.ts";

export async function scanGrep(
  registry: AdapterRegistry,
  query: GrepQuery,
  limits: ScanLimits = {},
): Promise<GrepHit[]> {
  const limit = query.limit ?? defaultHitLimit;
  return normalizeCandidates(
    registry,
    streamScanCandidates(registry, query, createScanBudget(limits)),
    limit,
  );
}

export interface ScanLimits {
  maxBytes?: number;
  timeoutMs?: number;
  now?: () => number;
}

export async function* streamScanCandidates(
  registry: AdapterRegistry,
  query: GrepQuery,
  budget: ScanBudget = createScanBudget(),
): AsyncIterable<CandidateHit> {
  const mode = query.mode ?? "plain";
  const lineMatches = compileLineMatcher(query.query, mode);
  for (const adapter of selectedAdapters(registry, query.provider)) {
    assertScanBudget(budget);
    if (!(await adapter.isAvailable())) continue;
    for await (const filePath of walkGlob(adapter.root(), adapter.sessionFiles)) {
      assertScanBudget(budget);
      yield* streamFileHits(filePath, lineMatches, budget);
    }
  }
}

export function validateGrepPattern(query: string, mode: GrepMode): RegExp | undefined {
  if (query.length > maxGrepPatternLength) {
    throw new Error(`Grep pattern exceeds ${maxGrepPatternLength} characters`);
  }
  if (mode === "regex") {
    if (hasUnsafeBacktrackingFeature(query) || hasMultipleVariableQuantifiers(query)) {
      throw new Error(
        "Unsafe regex: ambiguous repetition, quantified groups, lookarounds, and backreferences are not supported",
      );
    }
    try {
      return new RegExp(query, "i");
    } catch (error) {
      const message = error instanceof Error ? error.message : "invalid syntax";
      throw new Error(`Invalid regex: ${message}`, { cause: error });
    }
  }
  return undefined;
}

function compileLineMatcher(query: string, mode: GrepMode): (line: string) => boolean {
  const pattern = validateGrepPattern(query, mode);
  if (mode === "regex") {
    if (pattern === undefined) throw new Error("Regex validation did not compile a pattern");
    return (line) => pattern.test(line);
  }
  const needle = query.toLowerCase();
  if (mode === "plain") return (line) => line.toLowerCase().includes(needle);
  return (line) => fuzzyIncludes(line.toLowerCase(), needle);
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
  lineMatches: (line: string) => boolean,
  budget: ScanBudget,
): AsyncIterable<CandidateHit> {
  const info = await stat(filePath);
  if (info.size > maxFileSizeBytes) {
    throw new Error(`Grep file exceeds ${maxFileSizeBytes} bytes: ${filePath}`);
  }
  let lineNumber = 0;
  for await (const entry of readBoundedLines(filePath)) {
    lineNumber += 1;
    budget.bytes += entry.bytes;
    assertScanBudget(budget);
    if (!lineMatches(entry.line)) continue;
    yield { path: filePath, lineNumber };
  }
}

async function* readBoundedLines(filePath: string): AsyncIterable<{ line: string; bytes: number }> {
  const handle = await open(filePath, "r");
  const chunk = Buffer.allocUnsafe(64 * 1024);
  let lineParts: Buffer[] = [];
  let lineBytes = 0;
  let position = 0;
  try {
    for (;;) {
      const result = await handle.read(chunk, 0, chunk.length, position);
      if (result.bytesRead === 0) break;
      position += result.bytesRead;
      const data = chunk.subarray(0, result.bytesRead);
      let start = 0;
      for (;;) {
        const newline = data.indexOf(10, start);
        const end = newline === -1 ? data.length : newline;
        const segment = data.subarray(start, end);
        lineBytes += segment.length;
        if (lineBytes > maxGrepLineBytes) {
          throw new Error(`Grep line exceeds ${maxGrepLineBytes} bytes: ${filePath}`);
        }
        if (segment.length > 0) lineParts.push(Buffer.from(segment));
        if (newline === -1) break;
        const complete = Buffer.concat(lineParts, lineBytes);
        const contentBytes = complete.at(-1) === 13 ? lineBytes - 1 : lineBytes;
        yield { line: complete.subarray(0, contentBytes).toString("utf8"), bytes: lineBytes + 1 };
        lineParts = [];
        lineBytes = 0;
        start = newline + 1;
      }
    }
    if (lineBytes > 0) {
      const complete = Buffer.concat(lineParts, lineBytes);
      const contentBytes = complete.at(-1) === 13 ? lineBytes - 1 : lineBytes;
      yield { line: complete.subarray(0, contentBytes).toString("utf8"), bytes: lineBytes };
    }
  } finally {
    await handle.close();
  }
}

export interface ScanBudget {
  bytes: number;
  maxBytes: number;
  now: () => number;
  startedAt: number;
  timeoutMs: number;
}

export function createScanBudget(limits: ScanLimits = {}): ScanBudget {
  const now = limits.now ?? performance.now.bind(performance);
  return {
    bytes: 0,
    maxBytes: limits.maxBytes ?? maxScanBytes,
    now,
    startedAt: now(),
    timeoutMs: limits.timeoutMs ?? scanTimeoutMs,
  };
}

function assertScanBudget(budget: ScanBudget): void {
  if (budget.bytes > budget.maxBytes) {
    throw new Error(`Grep scan exceeds ${budget.maxBytes} bytes`);
  }
  if (budget.now() - budget.startedAt > budget.timeoutMs) {
    throw new Error(`Grep scan exceeds ${budget.timeoutMs} milliseconds`);
  }
}

function hasUnsafeBacktrackingFeature(pattern: string): boolean {
  if (/\\[1-9]/.test(pattern) || /\(\?(?:[=!]|<[=!])/.test(pattern)) return true;
  let escaped = false;
  let inCharacterClass = false;
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "[") {
      inCharacterClass = true;
      continue;
    }
    if (char === "]") {
      inCharacterClass = false;
      continue;
    }
    if (!inCharacterClass && char === ")") {
      const quantifier = pattern[index + 1];
      if (quantifier === "+" || quantifier === "*" || quantifier === "{") return true;
    }
  }
  return false;
}

function hasMultipleVariableQuantifiers(pattern: string): boolean {
  let escaped = false;
  let inCharacterClass = false;
  let quantifiers = 0;
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "[") {
      inCharacterClass = true;
      continue;
    }
    if (char === "]") {
      inCharacterClass = false;
      continue;
    }
    if (inCharacterClass) continue;
    if (char === "*" || char === "+" || (char === "?" && pattern[index - 1] !== "(")) {
      quantifiers += 1;
    } else if (char === "{") {
      const close = pattern.indexOf("}", index + 1);
      if (close !== -1 && pattern.slice(index + 1, close).includes(",")) quantifiers += 1;
    }
    if (quantifiers > 1) return true;
  }
  return false;
}

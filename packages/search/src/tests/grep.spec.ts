import type { CandidateHit } from "../types.ts";

import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { readJsonlLinesAt } from "@transcripts-mcp/core";

import {
  candidateWindow,
  maxFileSizeBytes,
  maxGrepLineBytes,
  maxGrepPatternLength,
} from "../constants.ts";
import {
  closeGrepFinders,
  grepTranscripts,
  isAdapterSessionFile,
  isGrepAvailable,
} from "../grep.ts";
import { normalizeCandidates } from "../normalize.ts";
import { scanGrep } from "../scan.ts";
import {
  createFixtureRegistry,
  createFixtureRoot,
  createFixtureAdapter,
  messageLine,
  removeFixtureRoot,
  writeSession,
} from "./helpers.ts";

describe("grep transcripts", () => {
  const roots: string[] = [];

  afterEach(async () => {
    await closeGrepFinders();
    await Promise.all(roots.splice(0).map((root) => removeFixtureRoot(root)));
  });

  async function fixtureWithRawOnlyNoise(): Promise<string> {
    const root = await createFixtureRoot();
    roots.push(root);
    await writeSession(root, "one", [
      messageLine("user", "visible unique phrase alpha42"),
      JSON.stringify({ envelopeOnly: true, noise: "alpha42-raw-only-token" }),
      messageLine("assistant", "normal reply"),
    ]);
    return root;
  }

  async function fixtureWithRejectedPrefix(): Promise<string> {
    const root = await createFixtureRoot();
    roots.push(root);
    await writeSession(root, "one", [
      JSON.stringify({ envelopeOnly: true, noise: "shared-token-1" }),
      JSON.stringify({ envelopeOnly: true, noise: "shared-token-2" }),
      JSON.stringify({ envelopeOnly: true, noise: "shared-token-3" }),
      JSON.stringify({ envelopeOnly: true, noise: "shared-token-4" }),
      messageLine("user", "shared-token in a real message"),
    ]);
    return root;
  }

  it("should match only adapter session files when checking finder paths", async () => {
    const root = await createFixtureRoot();
    roots.push(root);
    const adapter = createFixtureAdapter(root);

    expect(isAdapterSessionFile(adapter, "sessions/one.jsonl")).toBe(true);
    expect(isAdapterSessionFile(adapter, "outside.jsonl")).toBe(false);
    expect(isAdapterSessionFile(adapter, "sessions\\one.jsonl")).toBe(true);
  });

  it("should ignore non-session files when native and streaming grep scan the same root", async () => {
    const root = await createFixtureRoot();
    roots.push(root);
    await writeSession(root, "valid", [messageLine("user", "valid-session-token")]);
    await writeFile(join(root, "outside.jsonl"), `${messageLine("user", "outside-token")}\n`);
    const registry = createFixtureRegistry(root);

    const nativeOutside = await grepTranscripts(registry, { query: "outside-token" });
    const streamingOutside = await scanGrep(registry, { query: "outside-token" });
    expect(nativeOutside).toHaveLength(0);
    expect(streamingOutside).toHaveLength(0);

    const nativeValid = await grepTranscripts(registry, { query: "valid-session-token" });
    const streamingValid = await scanGrep(registry, { query: "valid-session-token" });
    expect(nativeValid.map((hit) => hit.sessionId)).toEqual(["valid"]);
    expect(streamingValid.map((hit) => hit.sessionId)).toEqual(["valid"]);
  });

  it("should return a normalized hit when the query matches message text", async () => {
    const root = await fixtureWithRawOnlyNoise();
    const hits = await scanGrep(createFixtureRegistry(root), {
      query: "visible unique phrase alpha42",
      mode: "plain",
    });
    expect(hits).toHaveLength(1);
    expect(hits[0]?.message.text).toBe("visible unique phrase alpha42");
    expect(hits[0]?.provider).toBe("fixture");
    expect(hits[0]?.sessionId).toBe("one");
  });

  it("should compile and match a normal fallback regex", async () => {
    const root = await fixtureWithRawOnlyNoise();
    const hits = await scanGrep(createFixtureRegistry(root), {
      query: "visible\\s+unique",
      mode: "regex",
    });
    expect(hits.map((hit) => hit.sessionId)).toEqual(["one"]);
  });

  it.each([
    ["invalid syntax", "[", "Invalid regex"],
    ["nested quantifiers", "(a+)+$", "Unsafe regex"],
    ["wrapped nested quantifiers", "((a+))+$", "Unsafe regex"],
    ["overlapping quantified alternatives", "(a|aa)+$", "Unsafe regex"],
    ["adjacent wildcards", ".*.*X", "Unsafe regex"],
    ["adjacent repeated literals", "a+a+$", "Unsafe regex"],
    ["oversized pattern", "x".repeat(maxGrepPatternLength + 1), "Grep pattern exceeds"],
  ])("should reject %s in fallback regex mode", async (_name, query, message) => {
    const root = await fixtureWithRawOnlyNoise();
    await expect(scanGrep(createFixtureRegistry(root), { query, mode: "regex" })).rejects.toThrow(
      message,
    );
  });

  it("should reject an oversized fallback line distinctly", async () => {
    const root = await createFixtureRoot();
    roots.push(root);
    await writeSession(root, "large-line", ["x".repeat(maxGrepLineBytes + 1)]);
    await expect(scanGrep(createFixtureRegistry(root), { query: "absent" })).rejects.toThrow(
      "Grep line exceeds",
    );
  });

  it("should reject an oversized fallback file distinctly", async () => {
    const root = await createFixtureRoot();
    roots.push(root);
    await writeSession(root, "large-file", ["x".repeat(maxFileSizeBytes + 1)]);
    await expect(scanGrep(createFixtureRegistry(root), { query: "absent" })).rejects.toThrow(
      "Grep file exceeds",
    );
  });

  it("should reject aggregate fallback byte-budget exhaustion", async () => {
    const root = await fixtureWithRawOnlyNoise();
    await expect(
      scanGrep(createFixtureRegistry(root), { query: "absent" }, { maxBytes: 10 }),
    ).rejects.toThrow("Grep scan exceeds 10 bytes");
  });

  it("should reject fallback elapsed-budget exhaustion", async () => {
    const root = await fixtureWithRawOnlyNoise();
    let elapsed = 0;
    await expect(
      scanGrep(
        createFixtureRegistry(root),
        { query: "absent" },
        {
          timeoutMs: 5,
          now: () => {
            elapsed += 10;
            return elapsed;
          },
        },
      ),
    ).rejects.toThrow("Grep scan exceeds 5 milliseconds");
  });

  it("should drop a raw-JSON-only grep match that fails parseRawLine", async () => {
    const root = await fixtureWithRawOnlyNoise();
    const hits = await grepTranscripts(createFixtureRegistry(root), {
      query: "alpha42-raw-only-token",
      mode: "plain",
    });
    expect(hits).toHaveLength(0);
  });

  it("should drop a raw-JSON-only match when the streaming fallback scans the line", async () => {
    const root = await fixtureWithRawOnlyNoise();
    const hits = await scanGrep(createFixtureRegistry(root), {
      query: "alpha42-raw-only-token",
      mode: "plain",
    });
    expect(hits).toHaveLength(0);
  });

  it("should return the valid hit when rejected candidates precede it and limit is 1", async () => {
    const root = await fixtureWithRejectedPrefix();
    const hits = await scanGrep(createFixtureRegistry(root), {
      query: "shared-token",
      mode: "plain",
      limit: 1,
    });
    expect(hits).toHaveLength(1);
    expect(hits[0]?.message.text).toBe("shared-token in a real message");
  });

  it("should return hits from a later file when an earlier file yields only rejected candidates", async () => {
    const root = await createFixtureRoot();
    roots.push(root);
    await writeSession(root, "aaa-noise", [
      JSON.stringify({ envelopeOnly: true, noise: "late-valid-token" }),
      JSON.stringify({ envelopeOnly: true, noise: "late-valid-token-again" }),
    ]);
    await writeSession(root, "zzz-valid", [
      messageLine("user", "late-valid-token in a real message"),
    ]);
    const hits = await scanGrep(createFixtureRegistry(root), {
      query: "late-valid-token",
      mode: "plain",
      limit: 1,
    });
    expect(hits).toHaveLength(1);
    expect(hits[0]?.sessionId).toBe("zzz-valid");
    expect(hits[0]?.message.text).toBe("late-valid-token in a real message");
  });

  it("should agree between native and streaming grep for the same fixture and limit", async () => {
    const root = await fixtureWithRejectedPrefix();
    const registry = createFixtureRegistry(root);
    const query = { query: "shared-token", mode: "plain" as const, limit: 1 };
    const native = await grepTranscripts(registry, query);
    const streaming = await scanGrep(registry, query);
    expect(native.map((hit) => hit.message.text)).toEqual(streaming.map((hit) => hit.message.text));
    expect(streaming).toHaveLength(1);
  });

  it("should read each file once when several candidates share a path", async () => {
    const root = await createFixtureRoot();
    roots.push(root);
    const path = await writeSession(root, "one", [
      messageLine("user", "shared-file-token first"),
      messageLine("assistant", "shared-file-token second"),
      messageLine("user", "shared-file-token third"),
    ]);
    const candidates: CandidateHit[] = [
      { path, lineNumber: 1 },
      { path, lineNumber: 2 },
      { path, lineNumber: 3 },
    ];
    const reads: string[] = [];
    const hits = await normalizeCandidates(
      createFixtureRegistry(root),
      iterate(candidates),
      10,
      (filePath, pathCandidates) => {
        reads.push(filePath);
        return readJsonlLinesAt(
          filePath,
          pathCandidates.map((candidate) => candidate.lineNumber),
        );
      },
    );
    expect(reads).toEqual([path]);
    expect(hits).toHaveLength(3);
  });

  it("should consume dense rejected candidates once when they cross windows", async () => {
    const root = await createFixtureRoot();
    roots.push(root);
    const lines = Array.from({ length: 300 }, (_, index) =>
      JSON.stringify({ envelopeOnly: true, noise: `dense-${index}` }),
    );
    lines.push(messageLine("user", "dense accepted message"));
    lines.push(...Array.from({ length: 99 }, () => JSON.stringify({ envelopeOnly: true })));
    const path = await writeSession(root, "dense", lines);
    let byteOffset = 0;
    const candidates = lines.map((line, index) => {
      const candidate = { path, lineNumber: index + 1, byteOffset };
      byteOffset += Buffer.byteLength(line) + 1;
      return candidate;
    });
    let consumed = 0;
    let reads = 0;
    let candidateStreamClosed = false;

    async function* denseCandidates(): AsyncIterable<CandidateHit> {
      try {
        yield* candidates;
      } finally {
        candidateStreamClosed = true;
      }
    }

    const hits = await normalizeCandidates(
      createFixtureRegistry(root),
      denseCandidates(),
      1,
      async (_filePath, pathCandidates) => {
        reads += 1;
        consumed += pathCandidates.length;
        return new Map(
          pathCandidates.flatMap((candidate) => {
            const line = lines[candidate.lineNumber - 1];
            return line === undefined ? [] : [[candidate.lineNumber, line]];
          }),
        );
      },
    );

    expect(hits.map((hit) => hit.lineNumber)).toEqual([301]);
    expect(consumed).toBe(candidateWindow * 3);
    expect(reads).toBe(3);
    expect(candidateStreamClosed).toBe(true);
  });

  it("should preserve candidate order when byte offsets are nonmonotonic", async () => {
    const root = await createFixtureRoot();
    roots.push(root);
    const lines = [
      messageLine("user", "first offset"),
      messageLine("user", "second offset"),
      messageLine("user", "third offset"),
    ];
    const path = await writeSession(root, "offset-order", lines);
    const secondOffset = Buffer.byteLength(`${lines[0]}\n`);
    const thirdOffset = secondOffset + Buffer.byteLength(`${lines[1]}\n`);
    const hits = await normalizeCandidates(
      createFixtureRegistry(root),
      iterate([
        { path, lineNumber: 3, byteOffset: thirdOffset },
        { path, lineNumber: 1, byteOffset: 0 },
        { path, lineNumber: 2, byteOffset: secondOffset },
      ]),
      3,
    );
    expect(hits.map((hit) => hit.lineNumber)).toEqual([3, 1, 2]);
  });

  it("should keep results isolated when registries use the same provider with different roots", async () => {
    const firstRoot = await createFixtureRoot();
    const secondRoot = await createFixtureRoot();
    roots.push(firstRoot, secondRoot);
    await writeSession(firstRoot, "first", [messageLine("user", "root-token first")]);
    await writeSession(secondRoot, "second", [messageLine("user", "root-token second")]);
    const firstRegistry = createFixtureRegistry(firstRoot);
    const secondRegistry = createFixtureRegistry(secondRoot);
    const query = { query: "root-token" };
    expect((await grepTranscripts(firstRegistry, query)).map((hit) => hit.sessionId)).toEqual([
      "first",
    ]);
    expect((await grepTranscripts(secondRegistry, query)).map((hit) => hit.sessionId)).toEqual([
      "second",
    ]);
    expect((await grepTranscripts(firstRegistry, query)).map((hit) => hit.sessionId)).toEqual([
      "first",
    ]);
  });

  it("should report a boolean when grep availability is probed", () => {
    expect(isGrepAvailable() === true || isGrepAvailable() === false).toBe(true);
  });
});

async function* iterate(items: readonly CandidateHit[]): AsyncIterable<CandidateHit> {
  for (const item of items) yield item;
}

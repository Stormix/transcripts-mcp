import { afterEach, describe, expect, it } from "vitest";

import { grepTranscripts, isGrepAvailable } from "../grep.ts";
import { scanGrep } from "../scan.ts";
import {
  createFixtureRegistry,
  createFixtureRoot,
  messageLine,
  removeFixtureRoot,
  writeSession,
} from "./helpers.ts";

describe("grep transcripts", () => {
  const roots: string[] = [];

  afterEach(async () => {
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

  it("should report a boolean when grep availability is probed", () => {
    expect(isGrepAvailable() === true || isGrepAvailable() === false).toBe(true);
  });
});

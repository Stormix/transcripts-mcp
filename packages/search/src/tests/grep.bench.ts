import type { AdapterRegistry } from "@transcripts-mcp/core";

import type { CandidateHit } from "../types.ts";

import { afterAll, beforeAll, test } from "vitest";

import { normalizeHits } from "../normalize.ts";
import { collectScanCandidates, scanGrep } from "../scan.ts";
import {
  createFixtureRegistry,
  createFixtureRoot,
  removeFixtureRoot,
  writeBulkSessions,
} from "./helpers.ts";

const SESSION_COUNT = 50;
const LINES_PER_SESSION = 20;
const CANDIDATE_CAP = 200;
const HIT_LIMIT = 50;

let root = "";
let registry: AdapterRegistry | undefined;
let candidates: CandidateHit[] = [];

function requireRegistry(): AdapterRegistry {
  if (registry === undefined) {
    throw new Error("grep bench fixture registry was not created");
  }
  return registry;
}

beforeAll(async () => {
  root = await createFixtureRoot();
  await writeBulkSessions(root, SESSION_COUNT, LINES_PER_SESSION);
  registry = createFixtureRegistry(root);
  candidates = await collectScanCandidates(
    registry,
    { query: "target", mode: "plain" },
    CANDIDATE_CAP,
  );
});

afterAll(async () => {
  await removeFixtureRoot(root);
});

test("scanGrep plain", async ({ bench }) => {
  const activeRegistry = requireRegistry();
  await bench("scanGrep plain", async () => {
    const hits = await scanGrep(activeRegistry, { query: "target", mode: "plain" });
    if (hits.length === 0) throw new Error("expected plain grep hits");
  }).run();
});

test("scanGrep regex", async ({ bench }) => {
  const activeRegistry = requireRegistry();
  await bench("scanGrep regex", async () => {
    const hits = await scanGrep(activeRegistry, { query: "target|phrase", mode: "regex" });
    if (hits.length === 0) throw new Error("expected regex grep hits");
  }).run();
});

test("scanGrep fuzzy", async ({ bench }) => {
  const activeRegistry = requireRegistry();
  await bench("scanGrep fuzzy", async () => {
    const hits = await scanGrep(activeRegistry, { query: "trgt", mode: "fuzzy" });
    if (hits.length === 0) throw new Error("expected fuzzy grep hits");
  }).run();
});

test("normalizeHits", async ({ bench }) => {
  const activeRegistry = requireRegistry();
  await bench("normalizeHits", async () => {
    const hits = await normalizeHits(activeRegistry, candidates, HIT_LIMIT);
    if (hits.length === 0) throw new Error("expected normalized hits");
  }).run();
});

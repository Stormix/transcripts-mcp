import type { SearchQuery } from "../types.ts";

import { Database } from "bun:sqlite";
import assert from "node:assert/strict";

import * as sqliteVec from "sqlite-vec";

import { normalizeCwd, slugifyCwd } from "@transcripts-mcp/core";

import { ensureSemanticSchema, searchVectors } from "../semantic.ts";

const queries = {
  provider: { query: "term", provider: "target" },
  role: { query: "term", role: "user" },
  cwd: { query: "term", cwd: "/target" },
  slug: { query: "term", cwd: "/target" },
  since: { query: "term", since: "2026-09-01T00:00:00Z" },
  offset: { query: "term", since: "2026-09-01T02:00:00+02:00" },
  until: { query: "term", until: "2026-09-10T00:00:00Z" },
  undated: {
    query: "term",
    since: "2026-09-01T00:00:00Z",
    until: "2026-09-10T00:00:00Z",
  },
  combined: {
    query: "term",
    provider: "target",
    role: "user",
    cwd: "/target",
    since: "2026-09-01T00:00:00Z",
    until: "2026-09-10T00:00:00Z",
  },
} satisfies Record<string, SearchQuery>;
const scenario = process.argv[2] ?? "";
const query = Object.entries(queries).find(([name]) => name === scenario)?.[1];
assert.ok(query, "expected a filter scenario");
const db = new Database(":memory:");
try {
  ensureSemanticSchema(db);
  sqliteVec.load(db);
  const insert = db.prepare(
    "INSERT INTO embeddings (path,line_number,provider,session_id,role,text,cwd,cwd_norm,project_slug,timestamp,effective_timestamp,vector) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
  );
  for (let index = 0; index < 6; index += 1) {
    const target = index >= 4;
    const vector = new Float32Array(target ? [0.8, 0.2 + index / 100] : [1, 0]);
    const cwd = target ? "/target" : "/other";
    insert.run(
      String(index),
      1,
      target ? "target" : "other",
      String(index),
      target ? "user" : "assistant",
      "term",
      scenario === "slug" ? null : cwd,
      scenario === "slug" ? null : normalizeCwd(cwd),
      slugifyCwd(cwd),
      scenario === "undated" ? null : "2026-09-06T00:00:00.000Z",
      target
        ? "2026-09-06T00:00:00.000Z"
        : scenario === "until"
          ? "2026-10-01T00:00:00.000Z"
          : "2026-08-01T00:00:00.000Z",
      new Uint8Array(vector.buffer),
    );
  }
  const native = searchVectors(db, new Float32Array([1, 0]), query, 1, true);
  const fallback = searchVectors(db, new Float32Array([1, 0]), query, 1, false);
  assert.deepEqual(
    native.map((hit) => hit.path),
    ["4"],
  );
  assert.deepEqual(
    native.map((hit) => hit.path),
    fallback.map((hit) => hit.path),
  );
  assert.deepEqual(searchVectors(db, new Float32Array([1, 0]), query, 0, true), []);
  if (scenario === "undated") assert.equal(native[0]?.timestamp, undefined);
  console.info("FILTER_OK");
} finally {
  db.close();
}

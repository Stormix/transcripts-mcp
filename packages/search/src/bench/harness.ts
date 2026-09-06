import { Database } from "bun:sqlite";
import assert from "node:assert/strict";
import { realpath } from "node:fs/promises";
import { cpus } from "node:os";
import { join } from "node:path";

import * as sqliteVec from "sqlite-vec";
import { z } from "zod";

import { buildIndex, TranscriptIndex, searchTranscripts } from "../fts.ts";
import { reciprocalRankFusion, type RankedItem } from "../fusion.ts";
import { grepTranscripts, isGrepAvailable } from "../grep.ts";
import { scanGrep } from "../scan.ts";
import { embedCorpus, ensureSemanticSchema, searchVectors } from "../semantic.ts";
import {
  appendMessage,
  checkCount,
  createCorpus,
  linesPerSession,
  messageCount,
  sessionCount,
} from "./fixture.ts";
import { measure } from "./measure.ts";
import { sampleSchema, type Measurement, type MetricId } from "./types.ts";

const root = process.argv[2];
assert.ok(root, "Missing fixture directory");
const indexPath = join(root, "index.db");
process.env.TRANSCRIPTS_MCP_INDEX = indexPath;
const registry = await createCorpus(root);
const semanticModule = await import("../semantic.ts");
const benchmarkSemanticPageSize = semanticModule.semanticCorpusPageSize ?? 1;
const scopes = await Promise.all(
  registry.list().map(async (adapter) => ({
    provider: adapter.id,
    root: await realpath(adapter.root()),
  })),
);
const measurements: Measurement[] = [];
const query = { query: "target", limit: 50 };

const first = await measure(
  "grep.native.cold",
  () => grepTranscripts(registry, query),
  (hits) => checkCount(hits.length, 50),
);
measurements.push(
  isGrepAvailable()
    ? first
    : {
        id: "grep.native.cold",
        status: "unavailable",
        detail: "Native grep unavailable; fallback timings excluded",
      },
);
for (const [id, text, expected] of [
  ["grep.native.warm", "target", 50],
  ["grep.native.miss", "absent-token-987654321", 0],
] satisfies Array<[MetricId, string, number]>) {
  measurements.push(
    isGrepAvailable()
      ? await measure(
          id,
          () => grepTranscripts(registry, { query: text, limit: 50 }),
          (hits) => checkCount(hits.length, expected),
          5,
        )
      : { id, status: "unavailable", detail: "Native grep unavailable" },
  );
}
for (const [id, text, mode, expected] of [
  ["grep.scan.plain", "target", "plain", 50],
  ["grep.scan.regex", "target.*message", "regex", 50],
  ["grep.scan.fuzzy", "trgt", "fuzzy", 50],
  ["grep.scan.miss", "absent-token-987654321", "plain", 0],
] satisfies Array<[MetricId, string, "plain" | "regex" | "fuzzy", number]>) {
  measurements.push(
    await measure(
      id,
      () => scanGrep(registry, { query: text, mode, limit: 50 }),
      (hits) => checkCount(hits.length, expected),
      3,
    ),
  );
}
measurements.push(
  await measure(
    "index.full",
    () => buildIndex(registry, { full: true }),
    (result) => {
      checkCount(result.files, sessionCount);
      checkCount(result.messages, messageCount);
    },
  ),
);
measurements.push(
  await measure(
    "index.unchanged",
    () => buildIndex(registry),
    (result) => {
      checkCount(result.files, 0);
      checkCount(result.skipped, sessionCount);
    },
    3,
  ),
);
await appendMessage(root);
measurements.push(
  await measure(
    "index.append",
    () => buildIndex(registry),
    (result) => {
      checkCount(result.files, 1);
      checkCount(result.skipped, sessionCount - 1);
      checkCount(result.messages, linesPerSession + 1);
    },
  ),
);
const semanticDb = new Database(indexPath);
try {
  ensureSemanticSchema(semanticDb);
  measurements.push(
    await measure(
      "semantic.build.fake",
      async () => {
        semanticDb.run("DELETE FROM embeddings");
        const batchSizes: number[] = [];
        let embedded = 0;
        const complete = await embedCorpus(
          semanticDb,
          semanticModule.semanticCorpusPageSize === undefined
            ? async () => {
                batchSizes.push(1);
                embedded += 1;
                return new Float32Array(384);
              }
            : {
                embedTexts: async (texts) => {
                  batchSizes.push(texts.length);
                  embedded += texts.length;
                  return texts.map(() => new Float32Array(384));
                },
              },
        );
        return { complete, embedded, batchSizes };
      },
      (result) => {
        assert.equal(result.complete, true);
        checkCount(result.embedded, messageCount + 1);
        checkCount(
          result.batchSizes.length,
          Math.ceil((messageCount + 1) / benchmarkSemanticPageSize),
        );
        assert.ok(result.batchSizes.every((size) => size <= benchmarkSemanticPageSize));
      },
    ),
  );
} finally {
  semanticDb.close();
}
const index = new TranscriptIndex();
try {
  measurements.push(
    await measure(
      "fts.warm",
      () => index.search({ query: "target", limit: 20 }, scopes),
      (hits) => checkCount(hits.length, 20),
      20,
    ),
  );
} finally {
  index.close();
}
measurements.push(
  await measure(
    "fts.reopen",
    () => searchTranscripts(registry, { query: "target", limit: 20 }),
    (hits) => checkCount(hits.length, 20),
    10,
  ),
);

const db = new Database(":memory:");
try {
  ensureSemanticSchema(db);
  let vectorAvailable = true;
  try {
    sqliteVec.load(db);
  } catch {
    vectorAvailable = false;
  }
  const embeddingColumns = z
    .array(z.object({ name: z.string() }))
    .parse(db.query("PRAGMA table_info(embeddings)").all());
  const hasEffectiveTimestamp = embeddingColumns.some(
    (column) => column.name === "effective_timestamp",
  );
  const hasSourceRoot = embeddingColumns.some((column) => column.name === "source_root");
  let insertSql: string;
  if (hasSourceRoot && hasEffectiveTimestamp) {
    insertSql =
      "INSERT INTO embeddings (path,line_number,provider,source_root,session_id,role,text,effective_timestamp,vector) VALUES (?,1,?,'fixture-root',?,'user','target','2026-09-06T00:00:00.000Z',?)";
  } else if (hasSourceRoot) {
    insertSql =
      "INSERT INTO embeddings (path,line_number,provider,source_root,session_id,role,text,vector) VALUES (?,1,?,'fixture-root',?,'user','target',?)";
  } else if (hasEffectiveTimestamp) {
    insertSql =
      "INSERT INTO embeddings (path,line_number,provider,session_id,role,text,effective_timestamp,vector) VALUES (?,1,?,?,'user','target','2026-09-06T00:00:00.000Z',?)";
  } else {
    insertSql =
      "INSERT INTO embeddings (path,line_number,provider,session_id,role,text,vector) VALUES (?,1,?,?,'user','target',?)";
  }
  const insert = db.prepare(insertSql);
  db.transaction(() => {
    for (let row = 0; row < messageCount; row += 1) {
      const vector = new Float32Array(384);
      vector[0] = 1;
      vector[1] = row < messageCount - 64 ? 0.001 + row / 100000 : 0.3 + row / 100000;
      insert.run(
        String(row),
        row < messageCount - 64 ? "other" : "selected",
        String(row),
        new Uint8Array(vector.buffer),
      );
    }
  })();
  const vector = new Float32Array(384);
  vector[0] = 1;
  const vectorScopes = [
    { provider: "other", root: "fixture-root" },
    { provider: "selected", root: "fixture-root" },
  ];
  for (const [id, provider, native] of [
    ["vector.native", undefined, true],
    ["vector.filtered", "selected", true],
    ["vector.cosine", "selected", false],
  ] satisfies Array<[MetricId, string | undefined, boolean]>) {
    if (native && !vectorAvailable) {
      measurements.push({ id, status: "unavailable", detail: "sqlite-vec extension unavailable" });
      continue;
    }
    measurements.push(
      await measure(
        id,
        () => searchVectors(db, vector, { query: "target", provider }, 20, native, vectorScopes),
        (hits) => {
          checkCount(hits.length, 20);
          if (provider !== undefined) assert.ok(hits.every((hit) => hit.provider === provider));
        },
        5,
      ),
    );
  }
  db.transaction(() => {
    for (let row = messageCount; row < messageCount * 4; row += 1) {
      const extraVector = new Float32Array(384);
      extraVector[0] = 1;
      insert.run(String(row), "other", String(row), new Uint8Array(extraVector.buffer));
    }
  })();
  measurements.push(
    await measure(
      "vector.filtered.large",
      () =>
        searchVectors(
          db,
          vector,
          { query: "target", provider: "selected" },
          20,
          true,
          vectorScopes,
        ),
      (hits) => {
        checkCount(hits.length, 20);
        assert.ok(hits.every((hit) => hit.provider === "selected"));
      },
      5,
    ),
  );
} finally {
  db.close();
}
const left: RankedItem[] = Array.from({ length: 100 }, (_, rank) => ({
  id: String(rank),
  rank: rank + 1,
}));
const right: RankedItem[] = Array.from({ length: 100 }, (_, rank) => ({
  id: String(rank + 50),
  rank: rank + 1,
}));
measurements.push(
  await measure(
    "fusion",
    () => reciprocalRankFusion([left, right]),
    (hits) => checkCount(hits.length, 150),
    100,
  ),
);
const result = sampleSchema.parse({
  environment: {
    bun: Bun.version,
    platform: process.platform,
    arch: process.arch,
    cpu: cpus()[0]?.model ?? "unreported",
  },
  measurements,
});
console.info(`BENCH_RESULT:${JSON.stringify(result)}`);

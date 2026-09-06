import { z } from "zod";

export const metricLabels = {
  "index.full": "Full index (4,096 messages)",
  "index.unchanged": "Index unchanged files",
  "index.append": "Index one appended session",
  "grep.native.cold": "Native grep: initialization + first query",
  "grep.native.warm": "Native grep: warm query",
  "grep.native.miss": "Native grep: no match",
  "grep.scan.plain": "Streaming grep: plain",
  "grep.scan.regex": "Streaming grep: regex",
  "grep.scan.fuzzy": "Streaming grep: fuzzy",
  "grep.scan.miss": "Streaming grep: no match",
  "fts.warm": "FTS: open index",
  "fts.reopen": "FTS: reopen index per query",
  "vector.native": "Vector search: SQLite",
  "vector.filtered": "Vector search: SQLite, selective filter",
  "vector.cosine": "Vector search: cosine, selective filter",
  fusion: "Rank fusion (2 × 100 hits)",
} satisfies Record<MetricId, string>;

export const metricIdSchema = z.enum([
  "index.full",
  "index.unchanged",
  "index.append",
  "grep.native.cold",
  "grep.native.warm",
  "grep.native.miss",
  "grep.scan.plain",
  "grep.scan.regex",
  "grep.scan.fuzzy",
  "grep.scan.miss",
  "fts.warm",
  "fts.reopen",
  "vector.native",
  "vector.filtered",
  "vector.cosine",
  "fusion",
]);
export type MetricId = z.infer<typeof metricIdSchema>;
export const measurementSchema = z
  .object({
    id: metricIdSchema,
    status: z.enum(["ok", "incorrect", "unavailable", "error"]),
    ms: z.number().finite().nonnegative().optional(),
    detail: z.string().max(500).optional(),
  })
  .refine(
    (row) => row.status !== "ok" || row.ms !== undefined,
    "Successful measurements require timing",
  );
export type Measurement = z.infer<typeof measurementSchema>;
export const environmentSchema = z.object({
  bun: z.string().max(100),
  platform: z.string().max(100),
  arch: z.string().max(100),
  cpu: z.string().max(200),
});
export const sampleSchema = z
  .object({
    environment: environmentSchema,
    measurements: z.array(measurementSchema).length(Object.keys(metricLabels).length),
  })
  .refine(
    (value) =>
      new Set(value.measurements.map((row) => row.id)).size === Object.keys(metricLabels).length,
    "Missing or duplicate metrics",
  );
export type Sample = z.infer<typeof sampleSchema>;
const revisionSchema = z.object({
  sha: z.string().regex(/^[a-f0-9]{40}$/),
  samples: z.array(sampleSchema).min(1).max(30),
});
export const comparisonSchema = z.object({
  schemaVersion: z.literal(1),
  suiteHash: z.string().regex(/^[a-f0-9]{64}$/),
  warmupRounds: z.literal(1),
  base: revisionSchema.nullable(),
  head: revisionSchema,
});
export type Comparison = z.infer<typeof comparisonSchema>;

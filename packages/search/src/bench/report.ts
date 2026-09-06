import type { Comparison, Measurement, MetricId, Sample } from "./types.ts";

import { metricIdSchema, metricLabels } from "./types.ts";

export function median(values: readonly number[]): number {
  if (values.length === 0) throw new Error("Cannot summarize empty samples");
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return ((sorted[middle] ?? 0) + (sorted[Math.floor((sorted.length - 1) / 2)] ?? 0)) / 2;
}

export function summarize(values: readonly number[]) {
  const center = median(values);
  const sorted = [...values].sort((left, right) => left - right);
  return {
    median: center,
    mad: median(values.map((value) => Math.abs(value - center))),
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1] ?? center,
  };
}

export function classify(base: readonly number[], head: readonly number[]): string {
  const before = summarize(base);
  const after = summarize(head);
  const change = after.median - before.median;
  if (before.median === 0) return "No timing baseline";
  if (
    Math.abs(change / before.median) < 0.1 ||
    Math.abs(change) <= 3 * Math.max(before.mad, after.mad)
  )
    return "Within noise";
  return change > 0 ? "Slower" : "Faster";
}

function timings(samples: Sample[], id: MetricId): number[] {
  const numbers = samples.flatMap((sample) =>
    sample.measurements.flatMap((row) =>
      row.id === id && row.status === "ok" && row.ms !== undefined ? [row.ms] : [],
    ),
  );
  return numbers.length === samples.length ? numbers : [];
}

function status(samples: Sample[], id: MetricId): Measurement["status"] {
  const rows = samples.flatMap((sample) => sample.measurements.filter((row) => row.id === id));
  if (rows.some((row) => row.status === "incorrect")) return "incorrect";
  if (rows.some((row) => row.status === "error")) return "error";
  if (rows.some((row) => row.status === "unavailable")) return "unavailable";
  return "ok";
}

function cell(numbers: number[], state: Measurement["status"]): string {
  if (numbers.length === 0) return state === "ok" ? "Missing timing" : state;
  const result = summarize(numbers);
  return `${result.median.toFixed(3)} ± ${result.mad.toFixed(3)} ms`;
}

function isExistingFailure(comparison: Comparison, id: MetricId): boolean {
  const baseline = comparison.base?.samples.flatMap((sample) =>
    sample.measurements.filter((row) => row.id === id),
  );
  const first = baseline?.[0];
  if (baseline === undefined || first?.status !== "incorrect" || first.detail === undefined)
    return false;
  const head = comparison.head.samples.flatMap((sample) =>
    sample.measurements.filter((row) => row.id === id),
  );
  return [...baseline, ...head].every(
    (row) => row.status === "incorrect" && row.detail === first.detail,
  );
}

export function hasNewFailures(comparison: Comparison): boolean {
  return comparison.head.samples.some((sample) =>
    sample.measurements.some(
      (row) =>
        row.status === "error" ||
        (row.status === "incorrect" && !isExistingFailure(comparison, row.id)),
    ),
  );
}

export function renderReport(comparison: Comparison): string {
  const { base, head } = comparison;
  const first = head.samples[0];
  if (first === undefined) throw new Error("Missing samples");
  const environment = first.environment;
  const samples = [...(base?.samples ?? []), ...head.samples];
  if (samples.some((sample) => JSON.stringify(sample.environment) !== JSON.stringify(environment)))
    throw new Error("Cannot compare different runtime environments");
  if (base !== null && base.samples.length !== head.samples.length)
    throw new Error("Unequal sample counts");
  const lines = [
    "<!-- transcripts-benchmark -->",
    "## Benchmark comparison",
    "",
    base === null
      ? `Commit: \`${head.sha.slice(0, 7)}\`.`
      : `main \`${base.sha.slice(0, 7)}\` → PR \`${head.sha.slice(0, 7)}\`.`,
    "",
    `${head.samples.length} measured rounds per revision; one discarded warm-up round. Medians ± median absolute deviation; lower is better.`,
    "",
    "| Operation | main | PR | Change | Assessment |",
    "| --- | ---: | ---: | ---: | --- |",
  ];
  for (const id of metricIdSchema.options) {
    const before = base === null ? [] : timings(base.samples, id);
    const after = timings(head.samples, id);
    const baseStatus = base === null ? "unavailable" : status(base.samples, id);
    const headStatus = status(head.samples, id);
    let assessment = headStatus === "ok" ? "No valid baseline" : headStatus;
    let delta = "—";
    if (before.length > 0 && after.length > 0) {
      assessment = classify(before, after);
      const baseline = median(before);
      if (baseline > 0) delta = `${((median(after) / baseline - 1) * 100).toFixed(1)}%`;
    } else if (isExistingFailure(comparison, id)) {
      assessment = "Existing failure on main";
    } else if (baseStatus === "incorrect" && headStatus === "ok") {
      assessment = "Correctness fixed";
    }
    lines.push(
      `| ${metricLabels[id]} | ${base === null ? "—" : cell(before, baseStatus)} | ${cell(after, headStatus)} | ${delta} | ${assessment} |`,
    );
  }
  const clean = (value: string) => value.replace(/[^a-zA-Z0-9 ._()+:-]/g, " ");
  lines.push(
    "",
    "A change is flagged only when it exceeds 10% and three times the larger median absolute deviation. This is a noise heuristic, not a statistical significance test. Timing changes are informational. New correctness failures and execution errors fail the job; identical assertion failures in every main and PR round remain visible without blocking the PR.",
    "",
    `Runtime: Bun ${clean(environment.bun)}, ${clean(environment.platform)} ${clean(environment.arch)}, ${clean(environment.cpu)}. Same runner, serial execution, alternating revision order. Suite: \`${comparison.suiteHash.slice(0, 12)}\`.`,
    "",
    "Fixtures: 32 sessions × 128 messages (~2 MiB), 4,096 vectors × 384 dimensions. Native cold includes finder initialization; filesystem caches are not flushed. Vector retrieval excludes model loading and embedding generation.",
    "",
    "<details>",
    "<summary>Tail latency (p95 of round averages)</summary>",
    "",
    "| Operation | main p95 | PR p95 |",
    "| --- | ---: | ---: |",
  );
  for (const id of metricIdSchema.options) {
    const before = base === null ? [] : timings(base.samples, id);
    const after = timings(head.samples, id);
    lines.push(
      `| ${metricLabels[id]} | ${before.length ? summarize(before).p95.toFixed(3) + " ms" : "—"} | ${after.length ? summarize(after).p95.toFixed(3) + " ms" : "—"} |`,
    );
  }
  lines.push(
    "",
    "</details>",
    "",
    "Raw samples and per-case failures are available in the workflow artifact.",
  );
  return lines.join("\n") + "\n";
}

import { describe, expect, it } from "vitest";

import { classify, median, renderReport, summarize } from "../../bench/report.ts";
import {
  comparisonSchema,
  metricIdSchema,
  sampleSchema,
  type Comparison,
  type Sample,
} from "../../bench/types.ts";

function sample(ms: number): Sample {
  return {
    environment: { bun: "1.4.0", platform: "linux", arch: "x64", cpu: "Test CPU" },
    measurements: metricIdSchema.options.map((id) => ({ id, status: "ok", ms })),
  };
}

function comparison(before: number[], after: number[]): Comparison {
  return {
    schemaVersion: 1,
    suiteHash: "a".repeat(64),
    warmupRounds: 1,
    base: { sha: "b".repeat(40), samples: before.map(sample) },
    head: { sha: "c".repeat(40), samples: after.map(sample) },
  };
}

describe("benchmark reports", () => {
  it("should report median, spread, and p95 when samples contain an outlier", () => {
    expect(summarize([10, 9, 100, 11, 10])).toEqual({ median: 10, mad: 1, p95: 100 });
    expect(median([4, 2, 3, 1])).toBe(2.5);
    expect(() => median([])).toThrow("empty");
  });

  it("should flag directional changes only when they exceed noise and ten percent", () => {
    expect(classify([10, 10, 10], [8, 8, 8])).toBe("Faster");
    expect(classify([10, 10, 10], [12, 12, 12])).toBe("Slower");
    expect(classify([10, 10, 10], [10.5, 10.5, 10.5])).toBe("Within noise");
    expect(classify([5, 10, 15], [8, 13, 18])).toBe("Within noise");
    expect(classify([0, 0, 0], [1, 1, 1])).toBe("No timing baseline");
  });

  it("should show negative latency changes when a PR is faster", () => {
    const output = renderReport(comparison([10, 10, 10], [8, 8, 8]));
    expect(output).toContain("-20.0% | Faster");
    expect(output).toContain("10.000 ± 0.000 ms");
    expect(output).toContain("main `bbbbbbb` → PR `ccccccc`");
  });

  it("should exclude timings when even one sample has incorrect results", () => {
    const data = comparison([10, 10, 10], [1, 1, 1]);
    const row = data.head.samples[1]?.measurements[0];
    if (row === undefined) throw new Error("Missing test sample");
    row.status = "incorrect";
    row.detail = "@everyone <script>do not render this</script>";
    const output = renderReport(data);
    expect(output).toContain("| incorrect | — | incorrect |");
    expect(output).not.toContain("do not render this");
    expect(output).not.toContain("@everyone");
  });

  it("should mark a correctness fix without comparing invalid baseline timings", () => {
    const data = comparison([1, 1, 1], [10, 10, 10]);
    const row = data.base?.samples[0]?.measurements[0];
    if (row === undefined) throw new Error("Missing test sample");
    row.status = "incorrect";
    expect(renderReport(data)).toContain("Correctness fixed");
  });

  it("should reject mismatched environments and sample counts", () => {
    const data = comparison([10, 10, 10], [10, 10]);
    expect(() => renderReport(data)).toThrow("Unequal sample counts");
    data.head.samples.push(sample(10));
    const first = data.head.samples[0];
    if (first === undefined) throw new Error("Missing sample");
    first.environment.bun = "2.0.0";
    expect(() => renderReport(data)).toThrow("different runtime environments");
  });

  it("should reject malformed, duplicated, missing, or non-finite measurements", () => {
    const data = sample(1);
    expect(sampleSchema.safeParse(data).success).toBe(true);
    const first = data.measurements[0];
    if (first === undefined) throw new Error("Missing sample");
    first.ms = Infinity;
    expect(sampleSchema.safeParse(data).success).toBe(false);
    first.ms = 1;
    data.measurements[1] = first;
    expect(sampleSchema.safeParse(data).success).toBe(false);
    data.measurements.pop();
    expect(sampleSchema.safeParse(data).success).toBe(false);
    expect(comparisonSchema.safeParse({}).success).toBe(false);
  });

  it("should render a local run with no baseline", () => {
    const data = comparison([1], [1]);
    data.base = null;
    expect(renderReport(data)).toContain("No valid baseline");
  });
});

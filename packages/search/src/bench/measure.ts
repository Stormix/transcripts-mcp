import type { Measurement, MetricId } from "./types.ts";

import { AssertionError } from "node:assert";

export async function measure<T>(
  id: MetricId,
  operation: () => T | Promise<T>,
  verify: (result: T) => void,
  iterations = 1,
  warmupIterations = iterations > 1 ? 3 : 0,
): Promise<Measurement> {
  let elapsed = 0;
  try {
    for (let warmup = 0; warmup < warmupIterations; warmup += 1) verify(await operation());
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const start = performance.now();
      const result = await operation();
      elapsed += performance.now() - start;
      verify(result);
    }
    return { id, status: "ok", ms: elapsed / iterations };
  } catch (error) {
    return {
      id,
      status: error instanceof AssertionError ? "incorrect" : "error",
      detail: (error instanceof Error ? error.message : "Operation failed").slice(0, 500),
    };
  }
}

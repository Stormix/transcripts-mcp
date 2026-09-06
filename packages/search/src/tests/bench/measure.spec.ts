import assert from "node:assert/strict";

import { describe, expect, it } from "vitest";

import { measure } from "../../bench/measure.ts";

describe("benchmark measurement", () => {
  it("should return timing only when every result is correct", async () => {
    let count = 0;
    const result = await measure(
      "fusion",
      () => ++count,
      (value) => assert.ok(value > 0),
      3,
    );
    expect(count).toBe(6);
    expect(result.status).toBe("ok");
    expect(result.ms).toBeGreaterThanOrEqual(0);
  });

  it("should discard timing when a result assertion fails", async () => {
    const result = await measure(
      "fusion",
      () => 0,
      (value) => assert.equal(value, 1),
    );
    expect(result.status).toBe("incorrect");
    expect(result.ms).toBeUndefined();
  });

  it("should distinguish operational errors from incorrect results", async () => {
    const result = await measure(
      "fusion",
      () => {
        throw new Error("unavailable database");
      },
      () => {},
    );
    expect(result.status).toBe("error");
    expect(result.ms).toBeUndefined();
    expect(result.detail).toContain("unavailable database");
  });
});

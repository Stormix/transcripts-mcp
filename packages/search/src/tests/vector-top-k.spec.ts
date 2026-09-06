import { describe, expect, it } from "vitest";

import { VectorTopK } from "../vector-top-k.ts";

describe("vector top-k", () => {
  it("should retain no more than the limit when candidates exceed it", () => {
    const top = new VectorTopK(5);
    for (let index = 0; index < 100; index += 1) {
      top.add(hit(String(index), index));
      expect(top.size).toBeLessThanOrEqual(5);
    }
    expect(top.toSorted().map((item) => item.score)).toEqual([99, 98, 97, 96, 95]);
  });

  it("should use SQLite binary path order when scores are tied", () => {
    const top = new VectorTopK(6);
    for (const path of ["tie-b", "😀", "a", "é", "tie-a", "Z"]) top.add(hit(path, 1));

    expect(top.toSorted().map((item) => item.path)).toEqual([
      "Z",
      "a",
      "tie-a",
      "tie-b",
      "é",
      "😀",
    ]);
  });
});

function hit(path: string, score: number) {
  return {
    provider: "fixture",
    sessionId: path,
    path,
    lineNumber: 1,
    role: "user",
    text: path,
    score,
  };
}

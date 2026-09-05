import { describe, expect, it } from "vitest";

import { reciprocalRankFusion } from "../fusion.ts";

describe("reciprocal rank fusion", () => {
  it("should fuse two ranked lists with RRF", () => {
    const fused = reciprocalRankFusion([
      [
        { id: "a", rank: 1 },
        { id: "b", rank: 2 },
      ],
      [
        { id: "a", rank: 2 },
        { id: "c", rank: 1 },
      ],
    ]);
    expect(fused[0]?.id).toBe("a");
    expect(fused.map((item) => item.id).sort()).toEqual(["a", "b", "c"]);
    expect(fused[0]?.score).toBeGreaterThan(fused[1]?.score ?? 0);
  });
});

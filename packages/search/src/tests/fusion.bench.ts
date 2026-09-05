import { test } from "vitest";

import { reciprocalRankFusion, type RankedItem } from "../fusion.ts";

const LIST_SIZE = 100;

function rankedList(prefix: string, offset: number): RankedItem[] {
  const items: RankedItem[] = [];
  for (let index = 0; index < LIST_SIZE; index += 1) {
    items.push({
      id: index < 50 ? `shared-${index}` : `${prefix}-${index + offset}`,
      rank: index + 1,
    });
  }
  return items;
}

const left = rankedList("left", 0);
const right = rankedList("right", 50);

test("reciprocalRankFusion", async ({ bench }) => {
  await bench("reciprocalRankFusion", () => {
    const fused = reciprocalRankFusion([left, right]);
    if (fused.length === 0) throw new Error("expected fused ranks");
  }).run();
});

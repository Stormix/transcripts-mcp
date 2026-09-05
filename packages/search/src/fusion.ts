export interface RankedItem {
  id: string;
  rank: number;
}

export interface FusedItem {
  id: string;
  score: number;
}

export function reciprocalRankFusion(
  lists: readonly (readonly RankedItem[])[],
  k = 60,
): FusedItem[] {
  const scores = new Map<string, number>();
  for (const list of lists) {
    for (const item of list) {
      const current = scores.get(item.id) ?? 0;
      scores.set(item.id, current + 1 / (k + item.rank));
    }
  }
  return [...scores.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((left, right) => right.score - left.score);
}

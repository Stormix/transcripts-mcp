import type { SearchHit } from "./types.ts";

export class VectorTopK {
  readonly #heap: SearchHit[] = [];

  constructor(readonly limit: number) {}

  get size(): number {
    return this.#heap.length;
  }

  add(candidate: SearchHit): void {
    if (this.limit < 1) return;
    if (this.#heap.length < this.limit) {
      this.#heap.push(candidate);
      this.#bubbleWorstUp(this.#heap.length - 1);
      return;
    }
    const worst = this.#heap[0];
    if (worst === undefined || compareVectorHits(candidate, worst) >= 0) return;
    this.#heap[0] = candidate;
    this.#sinkWorstDown(0);
  }

  toSorted(): SearchHit[] {
    return [...this.#heap].sort(compareVectorHits);
  }

  #bubbleWorstUp(start: number): void {
    let index = start;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      const current = this.#heap[index];
      const parentHit = this.#heap[parent];
      if (
        current === undefined ||
        parentHit === undefined ||
        compareVectorHits(current, parentHit) <= 0
      ) {
        return;
      }
      [this.#heap[index], this.#heap[parent]] = [parentHit, current];
      index = parent;
    }
  }

  #sinkWorstDown(start: number): void {
    let index = start;
    for (;;) {
      const left = index * 2 + 1;
      const right = left + 1;
      let worst = index;
      if (this.#isWorse(left, worst)) worst = left;
      if (this.#isWorse(right, worst)) worst = right;
      if (worst === index) return;
      const current = this.#heap[index];
      const replacement = this.#heap[worst];
      if (current === undefined || replacement === undefined) return;
      [this.#heap[index], this.#heap[worst]] = [replacement, current];
      index = worst;
    }
  }

  #isWorse(candidateIndex: number, currentIndex: number): boolean {
    const candidate = this.#heap[candidateIndex];
    const current = this.#heap[currentIndex];
    return (
      candidate !== undefined && current !== undefined && compareVectorHits(candidate, current) > 0
    );
  }
}

function compareVectorHits(left: SearchHit, right: SearchHit): number {
  if (left.score !== right.score) return right.score - left.score;
  const pathOrder = Buffer.compare(Buffer.from(left.path, "utf8"), Buffer.from(right.path, "utf8"));
  if (pathOrder !== 0) return pathOrder;
  return left.lineNumber - right.lineNumber;
}

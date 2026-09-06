import { Tensor } from "@huggingface/transformers";
import { describe, expect, it } from "vitest";

import { parsePipelineBatchOutput } from "../semantic-engine.ts";

describe("semantic engine batch output", () => {
  it("should preserve each vector when the tensor has the expected batch shape", () => {
    const values = new Float32Array(2 * 384);
    values[0] = 1;
    values[384] = 2;

    const vectors = parsePipelineBatchOutput(new Tensor("float32", values, [2, 384]), 2);

    expect(vectors).toHaveLength(2);
    expect(vectors[0]?.[0]).toBe(1);
    expect(vectors[1]?.[0]).toBe(2);
  });

  it("should reject vectors when the tensor width differs from the model dimensions", () => {
    const vectors = parsePipelineBatchOutput(
      new Tensor("float32", new Float32Array(2 * 385), [2, 385]),
      2,
    );

    expect(vectors).toEqual([undefined, undefined]);
  });
});

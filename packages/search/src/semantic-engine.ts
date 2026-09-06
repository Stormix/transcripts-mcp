import type { Database } from "bun:sqlite";

import { pipeline, Tensor } from "@huggingface/transformers";
import * as sqliteVec from "sqlite-vec";
import { z } from "zod";

import { embeddingDimensions as modelEmbeddingDimensions, modelId } from "./constants.ts";

const tensorSchema = z.object({
  data: z.instanceof(Float32Array),
  dims: z.array(z.number()),
});

const nestedVectorSchema = z.array(z.array(z.number()).min(modelEmbeddingDimensions));

const flatVectorSchema = z.array(z.number()).min(modelEmbeddingDimensions);

type FeatureExtractor = (
  texts: string | string[],
  options: { pooling: "mean"; normalize: true },
) => Promise<Tensor>;

let extractor: FeatureExtractor | undefined;
let extractorFailed = false;

export function embeddingDimensions(): number {
  return modelEmbeddingDimensions;
}

export async function embedText(text: string): Promise<Float32Array | undefined> {
  return (await embedTexts([text]))[0];
}

export async function embedTexts(
  texts: readonly string[],
): Promise<readonly (Float32Array | undefined)[]> {
  if (texts.length === 0) return [];
  const model = await loadExtractor();
  if (model === undefined) return texts.map(() => undefined);
  try {
    const output = await model([...texts], { pooling: "mean", normalize: true });
    return parsePipelineBatchOutput(output, texts.length);
  } catch (error) {
    console.error("semantic embed failed", error);
    return texts.map(() => undefined);
  }
}

export function tryLoadSqliteVec(db: Database): boolean {
  try {
    sqliteVec.load(db);
    db.query("select vec_version() as version").get();
    return true;
  } catch (error) {
    console.error("sqlite-vec unavailable; using cosine fallback", error);
    return false;
  }
}

async function loadExtractor(): Promise<FeatureExtractor | undefined> {
  if (extractorFailed) return undefined;
  if (extractor !== undefined) return extractor;
  try {
    const loaded = await pipeline("feature-extraction", modelId, { dtype: "fp32" });
    extractor = (texts, options) => loaded(texts, options);
    return extractor;
  } catch (error) {
    extractorFailed = true;
    console.error("semantic model unavailable", error);
    return undefined;
  }
}

function parsePipelineOutput(output: Tensor): Float32Array | undefined {
  const tensor = tensorSchema.safeParse(output);
  if (tensor.success) return firstDimensions(tensor.data.data);
  const nested = nestedVectorSchema.safeParse(output);
  if (nested.success) {
    const first = nested.data[0];
    if (first !== undefined) return firstDimensions(Float32Array.from(first));
  }
  const flat = flatVectorSchema.safeParse(output);
  if (flat.success) return firstDimensions(Float32Array.from(flat.data));
  return undefined;
}

export function parsePipelineBatchOutput(
  output: Tensor,
  batchSize: number,
): readonly (Float32Array | undefined)[] {
  const tensor = tensorSchema.safeParse(output);
  if (
    !tensor.success ||
    tensor.data.dims.length !== 2 ||
    tensor.data.dims[0] !== batchSize ||
    tensor.data.dims[1] !== modelEmbeddingDimensions ||
    tensor.data.data.length !== batchSize * modelEmbeddingDimensions
  ) {
    if (batchSize === 1) return [parsePipelineOutput(output)];
    return Array.from({ length: batchSize }, () => undefined);
  }
  return Array.from({ length: batchSize }, (_, index) => {
    const start = index * modelEmbeddingDimensions;
    return firstDimensions(tensor.data.data.slice(start, start + modelEmbeddingDimensions));
  });
}

function firstDimensions(values: Float32Array): Float32Array | undefined {
  if (values.length < modelEmbeddingDimensions) return undefined;
  if (values.length === modelEmbeddingDimensions) return values;
  return values.slice(0, modelEmbeddingDimensions);
}

import type { Database } from "bun:sqlite";

import { pipeline, Tensor } from "@huggingface/transformers";
import * as sqliteVec from "sqlite-vec";
import { z } from "zod";

import { embeddingDimensions as modelEmbeddingDimensions, modelId } from "./constants.ts";

const tensorSchema = z.object({
  data: z.instanceof(Float32Array),
});

const nestedVectorSchema = z.array(z.array(z.number()).min(modelEmbeddingDimensions));

const flatVectorSchema = z.array(z.number()).min(modelEmbeddingDimensions);

type FeatureExtractor = (
  text: string,
  options: { pooling: "mean"; normalize: true },
) => Promise<Float32Array | undefined>;

let extractor: FeatureExtractor | undefined;
let extractorFailed = false;

export function embeddingDimensions(): number {
  return modelEmbeddingDimensions;
}

export async function embedText(text: string): Promise<Float32Array | undefined> {
  const model = await loadExtractor();
  if (model === undefined) return undefined;
  try {
    return await model(text, { pooling: "mean", normalize: true });
  } catch (error) {
    console.error("semantic embed failed", error);
    return undefined;
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
    extractor = async (text, options) => {
      const output = await loaded(text, options);
      return parsePipelineOutput(output);
    };
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

function firstDimensions(values: Float32Array): Float32Array | undefined {
  if (values.length < modelEmbeddingDimensions) return undefined;
  if (values.length === modelEmbeddingDimensions) return values;
  return values.slice(0, modelEmbeddingDimensions);
}

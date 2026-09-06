import { toolContracts } from "@transcripts-mcp/contracts";

export const candidateWindow = 128;
export const defaultHitLimit = toolContracts.grepTranscripts.inputs.limit.default;
export const maxFileSizeBytes = toolContracts.grepTranscripts.resourceLimits.maxFileSizeBytes;
export const maxGrepLineBytes = toolContracts.grepTranscripts.resourceLimits.maxLineBytes;
export const maxGrepPatternLength = toolContracts.grepTranscripts.inputs.query.maxLength;
export const maxScanBytes = toolContracts.grepTranscripts.resourceLimits.maxScanBytes;
export const scanTimeoutMs = toolContracts.grepTranscripts.resourceLimits.scanTimeoutMs;
export const schemaVersion = 4;
export const schemaVersionKey = "schema_version";
export const modelId = "Xenova/all-MiniLM-L6-v2";
export const embeddingDimensions = 384;

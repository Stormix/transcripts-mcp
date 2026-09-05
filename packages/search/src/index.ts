export type {
  BuildIndexOptions,
  CandidateHit,
  GrepHit,
  GrepMode,
  GrepQuery,
  SearchHit,
  SearchQuery,
} from "./types.ts";
export { grepTranscripts, isGrepAvailable } from "./grep.ts";
export { lineMatches, scanGrep, streamScanCandidates } from "./scan.ts";
export { candidateWindow, normalizeCandidates } from "./normalize.ts";
export type { LineReader } from "./normalize.ts";
export { reciprocalRankFusion } from "./fusion.ts";
export type { FusedItem, RankedItem } from "./fusion.ts";
export {
  buildIndex,
  defaultIndexPath,
  ensureIndexDir,
  searchFts,
  searchTranscripts,
  TranscriptIndex,
} from "./fts.ts";
export type { BuildIndexResult } from "./fts.ts";

import type { Message } from "@transcripts-mcp/core";

export type GrepMode = "plain" | "regex" | "fuzzy";

export interface GrepQuery {
  query: string;
  mode?: GrepMode;
  provider?: string;
  limit?: number;
}

export interface CandidateHit {
  path: string;
  lineNumber: number;
  score?: number;
}

export interface GrepHit {
  provider: string;
  sessionId: string;
  path: string;
  lineNumber: number;
  message: Message;
  score?: number;
}

export interface SearchHit {
  provider: string;
  sessionId: string;
  path: string;
  lineNumber: number;
  role: string;
  text: string;
  cwd?: string;
  timestamp?: string;
  score: number;
}

export interface SearchScope {
  provider: string;
  root: string;
}

export interface SearchQuery {
  query: string;
  provider?: string;
  role?: string;
  cwd?: string;
  since?: string;
  until?: string;
  limit?: number;
  mode?: "fts" | "hybrid";
}

export interface BuildIndexOptions {
  full?: boolean;
  semantic?: boolean;
}

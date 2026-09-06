export const serverName = "transcripts-mcp";
export const serverVersion = "0.0.0";

export const toolNames = [
  "list_providers",
  "list_sessions",
  "get_transcript",
  "grep_transcripts",
  "search_transcripts",
  "build_index",
] as const;

export const defaultSessionLimit = 50;
export const defaultMessageLimit = 200;
export const sessionCountCap = 5000;

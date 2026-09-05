import type { TranscriptAdapter } from "@transcripts-mcp/core";

import { claudeCodeAdapter } from "./claude-code.ts";
import { codexAdapter } from "./codex.ts";
import { cursorAdapter } from "./cursor.ts";

export { claudeCodeAdapter } from "./claude-code.ts";
export { codexAdapter } from "./codex.ts";
export { cursorAdapter } from "./cursor.ts";

export const allAdapters: readonly TranscriptAdapter[] = [
  cursorAdapter,
  claudeCodeAdapter,
  codexAdapter,
];

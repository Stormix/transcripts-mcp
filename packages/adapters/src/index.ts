import type { TranscriptAdapter } from "@transcripts-mcp/core";

import { claudeCodeAdapter } from "./claude-code.ts";
import { codexAdapter } from "./codex.ts";
import { cursorAdapter } from "./cursor.ts";

export const allAdapters: readonly TranscriptAdapter[] = [
  cursorAdapter,
  claudeCodeAdapter,
  codexAdapter,
];

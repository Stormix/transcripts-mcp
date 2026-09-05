import { homedir } from "node:os";
import { join } from "node:path";

export function cursorRoot(): string {
  return process.env.CURSOR_HOME ?? join(homedir(), ".cursor");
}

export function claudeRoot(): string {
  return process.env.CLAUDE_HOME ?? join(homedir(), ".claude");
}

export function codexRoot(): string {
  return process.env.CODEX_HOME ?? join(homedir(), ".codex");
}

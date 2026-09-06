import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { z } from "zod";

import { createRegistry, defineJsonlAdapter } from "@transcripts-mcp/core";

const lineSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  text: z.string(),
  cwd: z.string().optional(),
});

export function createFixtureAdapter(root: string) {
  return defineJsonlAdapter({
    id: "fixture",
    displayName: "Fixture",
    root: () => root,
    sessionFiles: "sessions/*.jsonl",
    sessionIdFromPath: (filePath) => basename(filePath, ".jsonl"),
    lineSchema,
    toMessage: (line) => ({ role: line.role, text: line.text }),
    cwdFromLine: (line) => line.cwd,
  });
}

export function createSlugFixtureAdapter(root: string) {
  return defineJsonlAdapter({
    id: "cursor-like",
    displayName: "Cursor-like",
    root: () => root,
    sessionFiles: "projects/*/agent-transcripts/*/*.jsonl",
    sessionIdFromPath: (filePath) => basename(filePath, ".jsonl"),
    lineSchema,
    toMessage: (line) => ({ role: line.role, text: line.text }),
    projectSlugFromPath: (filePath) => {
      const parts = filePath.replaceAll("\\", "/").split("/");
      const projectsAt = parts.lastIndexOf("projects");
      if (projectsAt === -1) return undefined;
      const slug = parts[projectsAt + 1];
      return slug === undefined || slug.length === 0 ? undefined : slug;
    },
  });
}

export function createFixtureRegistry(root: string) {
  return createRegistry([createFixtureAdapter(root)]);
}

export async function createFixtureRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "transcripts-search-"));
  await mkdir(join(root, "sessions"), { recursive: true });
  return root;
}

export async function writeSession(root: string, id: string, lines: string[]): Promise<string> {
  const path = join(root, "sessions", `${id}.jsonl`);
  await writeFile(path, `${lines.join("\n")}\n`);
  return path;
}

export function messageLine(
  role: "user" | "assistant" | "system",
  text: string,
  cwd?: string,
): string {
  return JSON.stringify(cwd === undefined ? { role, text } : { role, text, cwd });
}

export async function writeSlugSession(
  root: string,
  slug: string,
  id: string,
  lines: string[],
): Promise<string> {
  const dir = join(root, "projects", slug, "agent-transcripts", id);
  await mkdir(dir, { recursive: true });
  const path = join(dir, `${id}.jsonl`);
  await writeFile(path, `${lines.join("\n")}\n`);
  return path;
}

export async function removeFixtureRoot(root: string): Promise<void> {
  try {
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  } catch (error) {
    const parsed = z.object({ code: z.string() }).safeParse(error);
    if (parsed.success && parsed.data.code === "EBUSY") return;
    throw error;
  }
}

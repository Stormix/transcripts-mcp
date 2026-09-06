import { realpath, stat } from "node:fs/promises";
import { platform } from "node:os";
import { isAbsolute, normalize, relative, resolve, sep } from "node:path";

import { globMatches } from "./glob";

export async function resolveTranscriptFile(
  filePath: string,
  root: string,
  sessionFiles: string,
): Promise<string> {
  const canonicalRoot = await resolveTranscriptRoot(root);
  const canonicalPath = await realpath(filePath);
  if (!isPathInside(canonicalPath, canonicalRoot)) {
    throw new Error(`Session path is outside adapter root: ${filePath}`);
  }
  const fileStats = await stat(canonicalPath);
  if (!fileStats.isFile()) {
    throw new Error(`Session path is not a file: ${filePath}`);
  }
  if (!globMatches(relative(canonicalRoot, canonicalPath), sessionFiles)) {
    throw new Error(`Session path does not match adapter session files: ${filePath}`);
  }
  return canonicalPath;
}

export async function resolveTranscriptRoot(root: string): Promise<string> {
  return realpath(root);
}

export function isPathInside(filePath: string, root: string): boolean {
  const absoluteFile = resolve(filePath);
  const absoluteRoot = resolve(root);
  const relativePath = relative(absoluteRoot, absoluteFile);
  if (relativePath.length === 0) return false;
  if (isAbsolute(relativePath)) return false;
  return relativePath !== ".." && !relativePath.startsWith(`..${sep}`);
}

export function normalizeCwd(value: string): string {
  const normalized = normalize(value);
  return platform() === "win32" ? normalized.toLowerCase() : normalized;
}

export function slugifyCwd(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function matchesCwdFilter(
  queryCwd: string,
  storedCwd: string | undefined,
  storedSlug: string | undefined,
): boolean {
  if (storedCwd !== undefined && normalizeCwd(storedCwd) === normalizeCwd(queryCwd)) {
    return true;
  }
  return storedSlug !== undefined && storedSlug === slugifyCwd(queryCwd);
}

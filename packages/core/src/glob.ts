import { readdir } from "node:fs/promises";
import { join } from "node:path";

const globSpecials = /[.+^${}()|[\]\\]/g;

export function matchSegment(name: string, pattern: string): boolean {
  if (pattern === "*") return true;
  const source = `^${pattern.replace(globSpecials, "\\$&").replaceAll("*", ".*")}$`;
  return new RegExp(source, "i").test(name);
}

export function globMatches(relativePath: string, pattern: string): boolean {
  const pathParts = relativePath
    .replaceAll("\\", "/")
    .split("/")
    .filter((part) => part.length > 0);
  const patternParts = pattern.split("/").filter((part) => part.length > 0);
  if (pathParts.length !== patternParts.length) return false;
  return patternParts.every((part, index) => {
    const segment = pathParts[index];
    return segment !== undefined && matchSegment(segment, part);
  });
}

export async function* walkGlob(root: string, pattern: string): AsyncGenerator<string> {
  const parts = pattern.split("/").filter((part) => part.length > 0);
  yield* walk(root, parts);
}

async function* walk(dir: string, parts: readonly string[]): AsyncGenerator<string> {
  const head = parts[0];
  if (head === undefined) return;
  const tail = parts.slice(1);

  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!matchSegment(entry.name, head)) continue;
    const full = join(dir, entry.name);
    if (tail.length === 0) {
      if (entry.isFile()) yield full;
      continue;
    }
    if (entry.isDirectory()) yield* walk(full, tail);
  }
}

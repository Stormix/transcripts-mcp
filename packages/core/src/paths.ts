import { platform } from "node:os";
import { isAbsolute, normalize, relative, resolve, sep } from "node:path";

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

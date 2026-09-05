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

import { dirname, join } from "node:path";

import { hostTarget } from "./targets.ts";

const binaryOverrideEnv = "TRANSCRIPTS_MCP_BINARY";

export function overrideBinaryPath(env: NodeJS.ProcessEnv): string | undefined {
  const value = env[binaryOverrideEnv];
  if (value === undefined || value.length === 0) return undefined;
  return value;
}

export function optionalBinaryPath(
  pkgName: string,
  fileName: string,
  resolveSpecifier: (specifier: string) => string,
): string | undefined {
  try {
    return join(dirname(resolveSpecifier(`${pkgName}/package.json`)), fileName);
  } catch {
    return undefined;
  }
}

export function hostOptionalBinary(
  platform: string,
  arch: string,
  resolveSpecifier: (specifier: string) => string,
): string | undefined {
  const target = hostTarget(platform, arch);
  return optionalBinaryPath(target.packageName, target.binaryFile, resolveSpecifier);
}

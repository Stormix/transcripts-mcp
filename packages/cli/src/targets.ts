export const cliPackageBase = "transcripts-mcp";

export type CliPlatform = "darwin" | "linux" | "win32";
export type CliArch = "arm64" | "x64";

export interface CliTarget {
  platform: CliPlatform;
  arch: CliArch;
  bunTarget: string;
  packageName: string;
  binaryFile: string;
}

export const cliTargets: readonly CliTarget[] = [
  {
    platform: "darwin",
    arch: "arm64",
    bunTarget: "bun-darwin-arm64",
    packageName: `${cliPackageBase}-darwin-arm64`,
    binaryFile: cliPackageBase,
  },
  {
    platform: "darwin",
    arch: "x64",
    bunTarget: "bun-darwin-x64",
    packageName: `${cliPackageBase}-darwin-x64`,
    binaryFile: cliPackageBase,
  },
  {
    platform: "linux",
    arch: "arm64",
    bunTarget: "bun-linux-arm64",
    packageName: `${cliPackageBase}-linux-arm64`,
    binaryFile: cliPackageBase,
  },
  {
    platform: "linux",
    arch: "x64",
    bunTarget: "bun-linux-x64",
    packageName: `${cliPackageBase}-linux-x64`,
    binaryFile: cliPackageBase,
  },
  {
    platform: "win32",
    arch: "x64",
    bunTarget: "bun-windows-x64",
    packageName: `${cliPackageBase}-win32-x64`,
    binaryFile: `${cliPackageBase}.exe`,
  },
];

export function targetFor(platform: string, arch: string): CliTarget | undefined {
  return cliTargets.find((target) => target.platform === platform && target.arch === arch);
}

export function hostTarget(platform: string, arch: string): CliTarget {
  const target = targetFor(platform, arch);
  if (target === undefined) {
    throw new Error(`unsupported platform ${platform}-${arch}`);
  }
  return target;
}

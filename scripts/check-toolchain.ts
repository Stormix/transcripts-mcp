import { readFile } from "node:fs/promises";

import { z } from "zod";

const packageSchema = z.object({
  engines: z.object({ node: z.string(), bun: z.string().regex(/^>=\d+\.\d+\.\d+$/) }),
  packageManager: z.string().regex(/^pnpm@\d+\.\d+\.\d+$/),
});
const packageJson = packageSchema.parse(JSON.parse(await readFile("package.json", "utf8")));
const versions = {
  nodejs: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/)
    .parse((await readFile(".nvmrc", "utf8")).trim()),
  pnpm: packageJson.packageManager.slice("pnpm@".length),
  bun: packageJson.engines.bun.slice(">=".length),
};

const mismatches: string[] = [];
check("package.json node engine", packageJson.engines.node, `>=${versions.nodejs}`);

for (const file of [
  ".github/workflows/ci.yml",
  ".github/workflows/benchmarks.yml",
  ".github/workflows/benchmark-comment.yml",
  ".github/workflows/release.yml",
]) {
  const content = await readFile(file, "utf8");
  checkPins(file, content, /runtime:\s*node@([^\s#]+)/g, versions.nodejs, "Node runtime");
  checkPins(file, content, /bun-version:\s*["']?([^\s"'#]+)/g, versions.bun, "Bun runtime");
}
checkPins(
  ".github/workflows/release.yml",
  await readFile(".github/workflows/release.yml", "utf8"),
  /node-version:\s*["']?([^\s"'#]+)/g,
  versions.nodejs,
  "Node publish runtime",
);

for (const file of ["AGENTS.md", "README.md", "CONTRIBUTING.md"]) {
  const content = await readFile(file, "utf8");
  requireText(file, content, versions.nodejs);
  requireText(file, content, versions.pnpm);
  requireText(file, content, versions.bun);
}

if (mismatches.length > 0) {
  throw new Error(`Toolchain pins are inconsistent:\n${mismatches.join("\n")}`);
}
console.info(
  `Toolchain pins match: Node ${versions.nodejs}, pnpm ${versions.pnpm}, Bun ${versions.bun}`,
);

function check(label: string, actual: string, expected: string): void {
  if (actual !== expected) mismatches.push(`${label}: expected ${expected}, received ${actual}`);
}

function requireText(label: string, content: string, expected: string): void {
  if (!content.includes(expected)) mismatches.push(`${label}: missing ${expected}`);
}

function checkPins(
  file: string,
  content: string,
  pattern: RegExp,
  expected: string,
  label: string,
): void {
  const values = [...content.matchAll(pattern)].flatMap((match) =>
    match[1] === undefined ? [] : [match[1]],
  );
  if (values.length === 0) {
    mismatches.push(`${file}: missing ${label}`);
    return;
  }
  for (const value of values) {
    if (value !== expected)
      mismatches.push(`${file}: ${label} expected ${expected}, received ${value}`);
  }
}

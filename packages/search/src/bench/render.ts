import { readFile, stat, writeFile } from "node:fs/promises";

import { z } from "zod";

import { renderReport } from "./report.ts";
import { comparisonSchema } from "./types.ts";

const [input, output, baseSha, headSha] = z
  .tuple([z.string(), z.string(), z.string(), z.string()])
  .parse(process.argv.slice(2));
if ((await stat(input)).size > 1024 * 1024)
  throw new Error("Benchmark artifact exceeds size limit");
const comparison = comparisonSchema.parse(JSON.parse(await readFile(input, "utf8")));
if (comparison.base?.sha !== baseSha || comparison.head.sha !== headSha)
  throw new Error("Benchmark commits do not match the current pull request");
await writeFile(output, renderReport(comparison));

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  renderToolContractMarkdown,
  toolContractList,
  toolContracts,
  toolErrorContracts,
  toolNames,
} from "../index.ts";

const repoRoot = join(import.meta.dirname, "../../../..");
const contractSurfaces = ["README.md", "distribution/plugin/skills/transcript-search/SKILL.md"];
const indexRecoverySurfaces = [
  "README.md",
  "packages/cli/README.md",
  "distribution/plugin/skills/transcript-search/SKILL.md",
  "apps/www/src/lib/site.ts",
];

describe("tool contract", () => {
  it("should list each tool exactly once when metadata is enumerated", () => {
    expect(toolContractList).toHaveLength(6);
    expect(new Set(toolNames).size).toBe(6);
  });

  it.each(contractSurfaces)(
    "should match canonical metadata when the %s contract fragment is checked",
    async (relativePath) => {
      const source = await readFile(join(repoRoot, relativePath), "utf8");
      expectContractFragment(source, relativePath);
    },
  );

  it.each(contractSurfaces)(
    "should only reference known tool names in %s prose",
    async (relativePath) => {
      const source = await readFile(join(repoRoot, relativePath), "utf8");
      const referencedNames = [...source.matchAll(/`([a-z]+(?:_[a-z]+)+)`/g)].map(
        (match) => match[1],
      );
      const staleNames = referencedNames.filter((name) => !toolNames.includes(name));
      expect(staleNames, `${relativePath} references unknown MCP tools`).toEqual([]);
    },
  );

  it("should keep duplicated README limits synchronized", async () => {
    const source = await readFile(join(repoRoot, "README.md"), "utf8");
    const sessions = toolContracts.listSessions.inputs.limit;
    const transcript = toolContracts.getTranscript.inputs.limit;
    const grep = toolContracts.grepTranscripts.inputs.limit;
    const search = toolContracts.searchTranscripts.inputs.limit;
    expect(source).toContain(
      `Result limits default to ${sessions.default} for session listing and grep, ${transcript.default} messages for transcript reads, and ${search.default} for indexed search. Maximums are ${sessions.maximum}, ${formatInteger(transcript.maximum)}, and ${search.maximum} respectively.`,
    );
    expect(grep.default).toBe(sessions.default);
    expect(grep.maximum).toBe(sessions.maximum);
  });

  it("should keep duplicated skill inputs synchronized", async () => {
    const source = await readFile(
      join(repoRoot, "distribution/plugin/skills/transcript-search/SKILL.md"),
      "utf8",
    );
    const grep = toolContracts.grepTranscripts.inputs;
    const transcript = toolContracts.getTranscript.inputs;
    expect(source).toContain(
      `- \`provider?\`, \`limit?\` (${grep.limit.minimum}–${grep.limit.maximum}, default ${grep.limit.default})`,
    );
    expect(source).toContain(
      `- \`limit?\` (${transcript.limit.minimum}–${transcript.limit.maximum}, default ${transcript.limit.default})`,
    );
  });

  it("should keep documented search modes synchronized", async () => {
    const readme = await readFile(join(repoRoot, "README.md"), "utf8");
    const skill = await readFile(
      join(repoRoot, "distribution/plugin/skills/transcript-search/SKILL.md"),
      "utf8",
    );
    const grepMode = toolContracts.grepTranscripts.inputs.mode;
    const searchMode = toolContracts.searchTranscripts.inputs.mode;
    const otherGrepModes = grepMode.values.filter((mode) => mode !== grepMode.default);

    expect(readme).toContain(
      `It supports \`${grepMode.default}\` (the default), \`${otherGrepModes[0]}\`, and \`${otherGrepModes[1]}\` modes.`,
    );
    expect(readme).toContain(`\`mode: "${searchMode.default}"\` (the default)`);
    expect(readme).toContain(`\`mode: "${searchMode.values[1]}"\``);
    expect(skill).toContain(
      `- \`mode\`: \`${grepMode.values[0]}\` \\| \`${grepMode.values[1]}\` \\| \`${grepMode.values[2]}\` (default \`${grepMode.default}\`)`,
    );
    expect(skill).toContain(
      `- \`mode\`: \`${searchMode.default}\` (default) or \`${searchMode.values[1]}\``,
    );
  });

  it("should keep descriptions synchronized with their structured metadata", () => {
    const transcript = toolContracts.getTranscript;
    expect(transcript.description).toContain(String(transcript.inputs.limit.default));
    expect(transcript.description).toContain(String(transcript.inputs.limit.maximum));

    const grep = toolContracts.grepTranscripts;
    for (const mode of grep.inputs.mode.values) expect(grep.description).toContain(mode);
    expect(grep.description).toContain(`${grep.resourceLimits.maxFileSizeBytes / 1024 / 1024} MiB`);
    expect(grep.description).toContain(`${grep.resourceLimits.maxLineBytes / 1024 / 1024} MiB`);
    expect(grep.description).toContain(`${grep.resourceLimits.maxScanBytes / 1024 / 1024} MiB`);
    expect(grep.description).toContain(`${grep.resourceLimits.scanTimeoutMs / 1000} second`);

    const search = toolContracts.searchTranscripts;
    for (const mode of search.inputs.mode.values) expect(search.description).toContain(mode);
    expect(search.description).toContain(`${search.inputs.mode.default} (default)`);
  });

  it.each(indexRecoverySurfaces)(
    "should keep index recovery identifiers synchronized in %s",
    async (relativePath) => {
      const source = await readFile(join(repoRoot, relativePath), "utf8");
      const recovery = toolErrorContracts.indexRebuildRequired;
      expect(source).toContain(recovery.code);
      expect(source).toContain(recovery.recovery.tool);
      expect(source).toContain("full: true");
      expect(source).toContain("semantic: true");
      expect(source).toContain("TRANSCRIPTS_MCP_INDEX");
    },
  );

  it("should name the stale surface when a documented maximum changes", async () => {
    const source = await readFile(join(repoRoot, "README.md"), "utf8");
    const stale = source.replace("limit? (1–200, default 50)", "limit? (1–201, default 50)");
    expect(() => expectContractFragment(stale, "README.md")).toThrow("README.md");
  });
});

function expectContractFragment(source: string, location: string): void {
  const startMarker = "<!-- tool-contract:start -->";
  const endMarker = "<!-- tool-contract:end -->";
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`${location} is missing the checked tool-contract markers`);
  }
  const actual = normalizeMarkdownTable(source.slice(start + startMarker.length, end));
  const expected = normalizeMarkdownTable(renderToolContractMarkdown());
  if (actual !== expected) throw new Error(`${location} has a stale tool-contract fragment`);
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function normalizeMarkdownTable(table: string): string {
  return table
    .trim()
    .split("\n")
    .map((line) => {
      const normalized = line.trim().replaceAll(/\s*\|\s*/g, "|");
      return /^\|(?:-+\|)+$/.test(normalized) ? normalized.replaceAll(/-+/g, "---") : normalized;
    })
    .join("\n");
}

type ToolInputType = "boolean" | "integer" | "string";

/** Serializable metadata for one MCP tool input. */
export interface ToolInputContract {
  type: ToolInputType;
  required?: true;
  values?: readonly string[];
  default?: string | number | boolean;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
}

/** Serializable public contract for one MCP tool. */
export interface ToolContract {
  name: string;
  description: string;
  inputs: Readonly<Record<string, ToolInputContract>>;
  resourceLimits?: Readonly<Record<string, number>>;
}

function defineToolContracts<const Contracts extends Record<string, ToolContract>>(
  contracts: Contracts,
): Contracts {
  return contracts;
}

/** Canonical metadata keyed by the runtime registration name used in source. */
export const toolContracts = defineToolContracts({
  listProviders: {
    name: "list_providers",
    description:
      "List transcript harnesses on this machine. Returns availability and a capped session file count.",
    inputs: {},
  },
  listSessions: {
    name: "list_sessions",
    description:
      "List session summaries filtered by provider, cwd, and time range. Newest first. Does not return full transcripts.",
    inputs: {
      provider: { type: "string" },
      cwd: { type: "string" },
      since: { type: "string" },
      until: { type: "string" },
      limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
    },
  },
  getTranscript: {
    name: "get_transcript",
    description:
      "Return the normalized transcript for one session (provider + id, optional path). Messages are capped (default 200, max 1000).",
    inputs: {
      provider: { type: "string", required: true },
      id: { type: "string", required: true },
      path: { type: "string" },
      limit: { type: "integer", minimum: 1, maximum: 1000, default: 200 },
    },
  },
  grepTranscripts: {
    name: "grep_transcripts",
    description:
      "Search raw transcript files without an index. Supports plain, regex, and fuzzy matching with 10 MiB file, 1 MiB line, 64 MiB scan, and 60 second fallback limits.",
    inputs: {
      query: { type: "string", required: true, minLength: 1, maxLength: 1024 },
      mode: { type: "string", values: ["plain", "regex", "fuzzy"], default: "fuzzy" },
      provider: { type: "string" },
      limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
    },
    resourceLimits: {
      maxFileSizeBytes: 10 * 1024 * 1024,
      maxLineBytes: 1024 * 1024,
      maxScanBytes: 64 * 1024 * 1024,
      scanTimeoutMs: 60_000,
    },
  },
  searchTranscripts: {
    name: "search_transcripts",
    description:
      "BM25-ranked search over normalized messages. mode=fts (default) or mode=hybrid after a semantic index build.",
    inputs: {
      query: { type: "string", required: true, minLength: 1 },
      mode: { type: "string", values: ["fts", "hybrid"], default: "fts" },
      provider: { type: "string" },
      role: { type: "string" },
      cwd: { type: "string" },
      since: { type: "string" },
      until: { type: "string" },
      limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
    },
  },
  buildIndex: {
    name: "build_index",
    description:
      "Build or refresh the FTS5 index. Pass full=true to rebuild from scratch. Pass semantic=true to also embed the corpus — first run downloads ~23MB ONNX (all-MiniLM-L6-v2).",
    inputs: {
      full: { type: "boolean", default: false },
      semantic: { type: "boolean", default: false },
    },
  },
});

/** Stable machine-readable errors returned by transcript tools. */
export const toolErrorContracts = defineToolErrorContracts({
  indexRebuildRequired: {
    code: "INDEX_REBUILD_REQUIRED",
    message: "The local search index was created by an incompatible server version.",
    recovery: {
      tool: toolContracts.buildIndex.name,
      arguments: { full: true },
    },
  },
});

function defineToolErrorContracts<
  const Contracts extends Record<
    string,
    {
      code: string;
      message: string;
      recovery: { tool: string; arguments: Readonly<Record<string, string | number | boolean>> };
    }
  >,
>(contracts: Contracts): Contracts {
  return contracts;
}

/** Canonical tool metadata in the order shown on public documentation surfaces. */
export const toolContractList = [
  toolContracts.listProviders,
  toolContracts.listSessions,
  toolContracts.getTranscript,
  toolContracts.grepTranscripts,
  toolContracts.searchTranscripts,
  toolContracts.buildIndex,
];

/** MCP protocol tool names derived from the canonical metadata. */
export const toolNames = toolContractList.map((tool) => tool.name);

/** Render a compact, human-readable summary of a tool's input metadata. */
export function formatToolInputs(
  inputs: Readonly<Record<string, ToolInputContract>>,
  markdownRequired = false,
): string {
  const entries = Object.entries(inputs);
  if (entries.length === 0) return "—";
  return entries
    .map(([name, input]) => {
      const label = input.required ? (markdownRequired ? `**${name}**` : name) : `${name}?`;
      const details = formatInputDetails(input);
      return details === "" ? label : `${label} (${details})`;
    })
    .join(" · ");
}

/** Render the canonical MCP tool metadata as a Markdown table. */
export function renderToolContractMarkdown(): string {
  const rows = toolContractList.map(
    (tool) => `| \`${tool.name}\` | ${tool.description} | ${formatToolInputs(tool.inputs, true)} |`,
  );
  return ["| Tool | Purpose | Inputs |", "| --- | --- | --- |", ...rows].join("\n");
}

function formatInputDetails(input: ToolInputContract): string {
  const details: string[] = [];
  if (input.values !== undefined) details.push(input.values.join("/"));
  if (input.minimum !== undefined && input.maximum !== undefined) {
    details.push(`${input.minimum}–${input.maximum}`);
  } else if (input.maximum !== undefined) {
    details.push(`max ${input.maximum}`);
  }
  if (input.maxLength !== undefined) details.push(`max ${input.maxLength} chars`);
  if (input.default !== undefined) details.push(`default ${String(input.default)}`);
  return details.join(", ");
}

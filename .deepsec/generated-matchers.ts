import { compileDeclarativeMatchers, type DeepsecPlugin } from "deepsec/config";

const specs = [
  {
    version: 1,
    slug: "mcp-stdio-bootstrap",
    description: "Detects MCP SDK stdio transport bootstrap and concrete McpServer construction.",
    noiseTier: "precise",
    filePatterns: ["apps/mcp/src/index.ts", "apps/mcp/src/server.ts"],
    requires: {
      sentinelFiles: ["apps/mcp/package.json"],
    },
    patterns: [
      {
        source: "^void\\s+serveStdio\\s*\\(",
        flags: "m",
        label: "MCP stdio server bootstrap",
      },
      {
        source: "^\\s*const\\s+server\\s*=\\s*new\\s+McpServer\\s*\\(",
        flags: "m",
        label: "MCP server construction",
      },
    ],
    examples: [
      "void serveStdio(() => createServer());",
      "  const server = new McpServer({ name: serverName, version: serverVersion });",
    ],
    closesSurfaceIds: ["mcp-stdio-agent-tools"],
  },
  {
    version: 1,
    slug: "jsonl-transcript-adapter-registration",
    description:
      "Detects definitions and registrations of transcript adapters through the repository's defineJsonlAdapter primitive.",
    noiseTier: "precise",
    filePatterns: [
      "packages/adapters/src/claude-code.ts",
      "packages/adapters/src/codex.ts",
      "packages/adapters/src/cursor.ts",
      "packages/core/src/adapter.ts",
    ],
    requires: {
      sentinelFiles: ["packages/adapters/package.json", "packages/core/package.json"],
    },
    patterns: [
      {
        source: "^export\\s+function\\s+defineJsonlAdapter(?:<[^>\\r\\n]+>)?\\s*\\(",
        flags: "m",
        label: "JSONL adapter definition primitive",
      },
      {
        source: "^\\s*return\\s+defineJsonlAdapter\\s*\\(\\s*\\{",
        flags: "m",
        label: "Transcript adapter registration",
      },
    ],
    examples: [
      "export function defineJsonlAdapter<TLine>(spec: JsonlAdapterSpec<TLine>): TranscriptAdapter {",
      "  return defineJsonlAdapter({",
    ],
    closesSurfaceIds: ["mcp-stdio-agent-tools"],
  },
  {
    version: 1,
    slug: "tanstack-start-file-route",
    description:
      "Detects concrete TanStack Router file-route and root-route registrations exposed through the TanStack Start application.",
    noiseTier: "precise",
    filePatterns: ["apps/www/src/routes/*.tsx"],
    requires: {
      sentinelFiles: ["apps/www/package.json", "apps/www/vite.config.ts"],
    },
    patterns: [
      {
        source:
          "^export\\s+const\\s+Route\\s*=\\s*createFileRoute\\s*\\(\\s*[\"'][^\"'\\r\\n]+[\"']\\s*\\)\\s*\\(",
        flags: "m",
        label: "TanStack file-route registration",
      },
      {
        source: "^export\\s+const\\s+Route\\s*=\\s*createRootRoute\\s*\\(\\s*\\{",
        flags: "m",
        label: "TanStack root-route registration",
      },
    ],
    examples: [
      'export const Route = createFileRoute("/about")({',
      'export const Route = createFileRoute("/")({',
      "export const Route = createRootRoute({",
    ],
    closesSurfaceIds: ["public-documentation-http"],
  },
  {
    version: 1,
    slug: "npm-platform-binary-resolution",
    description:
      "Detects a published npm executable whose launcher resolves operator overrides and platform-specific optional binaries.",
    noiseTier: "precise",
    filePatterns: [
      "packages/cli/package.json",
      "packages/cli/src/resolve.ts",
      "packages/cli/src/targets.ts",
    ],
    requires: {
      sentinelFiles: ["packages/cli/package.json"],
    },
    patterns: [
      {
        source: '"bin"\\s*:\\s*\\{\\s*"transcripts-mcp"\\s*:\\s*"\\./dist/cli\\.js"',
        label: "npm executable registration",
      },
      {
        source: "^export\\s+function\\s+(?:overrideBinaryPath|hostOptionalBinary)\\s*\\(",
        flags: "m",
        label: "CLI binary path resolution",
      },
      {
        source: "^export\\s+(?:const\\s+cliTargets|function\\s+(?:targetFor|hostTarget))\\b",
        flags: "m",
        label: "CLI platform target resolution",
      },
    ],
    examples: [
      '"bin": {\n    "transcripts-mcp": "./dist/cli.js"',
      "export function overrideBinaryPath(env: NodeJS.ProcessEnv): string | undefined {",
      "export function hostOptionalBinary(",
      "export const cliTargets: readonly CliTarget[] = [",
      "export function hostTarget(platform: string, arch: string): CliTarget {",
    ],
    closesSurfaceIds: ["npm-cli-launcher"],
  },
];

export const generatedMatchersPlugin: DeepsecPlugin = {
  name: "deepsec-generated-matchers",
  matchers: compileDeclarativeMatchers(specs),
};

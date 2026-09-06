# transcripts-mcp

Search your Cursor, Claude Code, and Codex conversations from any MCP client.

transcripts-mcp reads session transcripts already on your machine. Use it to find a previous implementation, recover the reasoning behind a decision, or bring context from one coding tool into another.

[![Install in Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=transcripts&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsInRyYW5zY3JpcHRzLW1jcCJdfQ%3D%3D)
[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?%7B%22name%22%3A%22transcripts%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22transcripts-mcp%22%5D%7D)

[Website](https://transcriptsmcp.dev/) · [Setup](#configure) · [Tool reference](#tools) · [Contributing](CONTRIBUTING.md)

## What it does

- **Browse sessions** across all three tools, filtered by project or date.
- **Read conversations** as normalized messages, with a limit on how much is returned.
- **Search immediately** with fuzzy, plain-text, or regex matching. No index required.
- **Rank results** with a local full-text index and optional semantic search.

For example, ask your connected client:

> Find the Claude Code conversation where we added authentication to this project.

> Read my most recent Cursor session and summarize what remains to be done.

> Search my Codex transcripts for the database migration error.

The server returns transcript text for the current client to read. It does not restore a previous session's model state.

## Install

Requires Node.js 24 or later for the npm launcher. Add the command below to your MCP client using one of the configurations in the next section:

```bash
npx -y transcripts-mcp
```

You can also launch with `pnpm dlx transcripts-mcp` or `bunx --bun transcripts-mcp`.

The npm and pnpm launchers use a platform binary with grep and full-text search. If that binary is unavailable, they look for Bun on `PATH`. Optional semantic search requires running under Bun; see [Search](#search).

The server communicates over stdio and is intended to be launched by an MCP client.

## Configure

Choose your client below, save the configuration, and restart the client.

### Cursor

Add to `~/.cursor/mcp.json` for all projects, or `.cursor/mcp.json` for one project:

```json
{
  "mcpServers": {
    "transcripts": {
      "command": "npx",
      "args": ["-y", "transcripts-mcp"]
    }
  }
}
```

### Claude Code

Register the server for your user account:

```bash
claude mcp add --scope user transcripts -- npx -y transcripts-mcp
```

For project scope, add the same `mcpServers` configuration shown above to `.mcp.json` at the repository root.

### Codex

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.transcripts]
command = "npx"
args = ["-y", "transcripts-mcp"]
```

### Cursor plugin

The repository also includes a Cursor plugin in [distribution/plugin](distribution/plugin). For local development on macOS or Linux, symlink it into Cursor's local plugin directory:

```bash
ln -s /path/to/transcripts-mcp/distribution/plugin ~/.cursor/plugins/local/transcripts-mcp
```

The plugin includes an MCP configuration pinned to a package version.

### Claude Code plugin

Install the MCP server and transcript-search skill together from the repository's marketplace. Run these commands inside Claude Code:

```text
/plugin marketplace add Stormix/transcripts-mcp
/plugin install transcripts-mcp@stormix-plugins
```

The Claude Code and Cursor plugins share the same version-pinned MCP configuration and skill in [distribution/plugin](distribution/plugin). Requires Node.js 24 or later for the npm launcher.

For local development, run from the repository root:

```bash
claude --plugin-dir ./distribution/plugin
```

Check `/mcp` for the transcripts server, then try `/transcripts-mcp:transcript-search`. Run `/reload-plugins` after changing the plugin configuration.

See the [Claude Code plugin docs](https://code.claude.com/docs/en/plugins) for development and troubleshooting.

## Tools

<!-- tool-contract:start -->

| Tool                 | Purpose                                                                                                                                                                   | Inputs                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `list_providers`     | List transcript harnesses on this machine. Returns availability and a capped session file count.                                                                          | —                                                                                                                     |
| `list_sessions`      | List session summaries filtered by provider, cwd, and time range. Newest first. Does not return full transcripts.                                                         | provider? · cwd? · since? · until? · limit? (1–200, default 50)                                                       |
| `get_transcript`     | Return the normalized transcript for one session (provider + id, optional path). Messages are capped (default 200, max 1000).                                             | **provider** · **id** · path? · limit? (1–1000, default 200)                                                          |
| `grep_transcripts`   | Search raw transcript files without an index. Supports plain, regex, and fuzzy matching with 10 MiB file, 1 MiB line, 64 MiB scan, and 60 second fallback limits.         | **query** (max 1024 chars) · mode? (plain/regex/fuzzy, default fuzzy) · provider? · limit? (1–200, default 50)        |
| `search_transcripts` | BM25-ranked search over normalized messages. mode=fts (default) or mode=hybrid after a semantic index build.                                                              | **query** · mode? (fts/hybrid, default fts) · provider? · role? · cwd? · since? · until? · limit? (1–100, default 20) |
| `build_index`        | Build or refresh the FTS5 index. Pass full=true to rebuild from scratch. Pass semantic=true to also embed the corpus — first run downloads ~23MB ONNX (all-MiniLM-L6-v2). | full? (default false) · semantic? (default false)                                                                     |

<!-- tool-contract:end -->

Bold inputs are required. Provider IDs are `cursor`, `claude-code`, and `codex`. Date filters use ISO-8601 timestamps.

Result limits default to 50 for session listing and grep, 200 messages for transcript reads, and 20 for indexed search. Maximums are 200, 1,000, and 100 respectively.

## Search

### Search without an index

`grep_transcripts` searches raw JSONL files and returns adapter-normalized results. It supports `fuzzy` (the default), `plain`, and `regex` modes.

Search uses `@ff-labs/fff-bun`. If the native library cannot load, the server falls back to a streaming scan.

### Full-text search

Call `build_index`, then use `search_transcripts` with `mode: "fts"` (the default). Results are ranked with SQLite FTS5's BM25 scoring over normalized message text.

Run `build_index` again to pick up transcript changes. Set `full: true` to rebuild from scratch.

### Semantic search

Run the server with Bun:

```json
{
  "mcpServers": {
    "transcripts": {
      "command": "bunx",
      "args": ["--bun", "transcripts-mcp"]
    }
  }
}
```

Call `build_index` with `semantic: true`, then search with `mode: "hybrid"`. Hybrid search combines full-text and vector results using reciprocal rank fusion.

The first semantic build downloads the `all-MiniLM-L6-v2` model. Embeddings are computed locally. The compiled platform binary does not include the semantic engine.

## Configuration

Transcript directories are discovered automatically. Set these environment variables in your MCP client's server configuration to override the defaults:

| Variable                | Default                       |
| ----------------------- | ----------------------------- |
| `CURSOR_HOME`           | `~/.cursor`                   |
| `CLAUDE_HOME`           | `~/.claude`                   |
| `CODEX_HOME`            | `~/.codex`                    |
| `TRANSCRIPTS_MCP_INDEX` | `~/.transcripts-mcp/index.db` |

## Privacy and local storage

The server reads transcripts without modifying them. Search and embedding computation run locally; the server does not upload transcript content.

Results are returned to the MCP client that requests them. That client may send retrieved text to its model provider according to its own settings.

Indexed search stores message text and, when enabled, embeddings in the local SQLite index. Semantic search also downloads and caches model files on first use.

## From source

Requires [Bun](https://bun.sh) >= 1.4.0, [Node.js](https://nodejs.org) >= 26.8.1, and [pnpm](https://pnpm.io) 12.3.3. Exact development and CI pins live in `.tool-versions`.

```bash
git clone https://github.com/Stormix/transcripts-mcp.git
cd transcripts-mcp
pnpm install
pnpm start
```

To connect an MCP client to your checkout, use an absolute path to the server entry point:

```json
{
  "mcpServers": {
    "transcripts": {
      "command": "bun",
      "args": ["/absolute/path/to/transcripts-mcp/apps/mcp/src/index.ts"]
    }
  }
}
```

On Windows, use forward slashes or escaped backslashes in JSON paths. The server writes JSON-RPC to stdout and logs to stderr.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, checks, and instructions for adding a transcript adapter.

The TypeScript monorepo is organized around three libraries: `packages/core` defines the transcript model, `packages/adapters` reads each provider's format, and `packages/search` implements search. The stdio server lives in `apps/mcp`; the published launcher lives in `packages/cli`.

AI-assisted contributions follow the [AI Policy](AI_POLICY.md). Please use [SECURITY.md](SECURITY.md) to report vulnerabilities and follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE)

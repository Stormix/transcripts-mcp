# transcripts-mcp

Local stdio MCP server that queries Cursor, Claude Code, and Codex session transcripts already on disk.

[![Install in Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=transcripts&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsInRyYW5zY3JpcHRzLW1jcCJdfQ%3D%3D)
[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?%7B%22name%22%3A%22transcripts%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22transcripts-mcp%22%5D%7D)

Site: [transcriptsmcp.dev](https://transcriptsmcp.dev/)

Each harness already writes JSONL as you work. Point any MCP client at this server and they can list, dump, and search those sessions. Nothing is uploaded; the server only reads local files (plus an optional search index under `~/.transcripts-mcp`).

## What you can ask

Once a client has the server configured:

- What was I working on in my last Cursor session?
- Search my Claude Code transcripts for authentication
- Dump the Codex session from this afternoon
- Which providers have sessions on this machine?

That is searchable transcript text, not the previous session's memory. The other tool still has to read.

## Install

```bash
npx -y transcripts-mcp
bunx --bun transcripts-mcp
pnpm dlx transcripts-mcp
```

`npx` / `pnpm dlx` spawn the platform binary (native fff + FTS; no semantic). `bunx --bun` runs the bundled server in-process and can use semantic/hybrid. If the binary is missing, the shim looks for `bun` on PATH.

## Cursor plugin

This repo is a Cursor Plugin. Install it from Customize, or symlink for local work:

```bash
ln -s /path/to/transcripts-mcp/distribution/plugin ~/.cursor/plugins/local/transcripts-mcp
```

The plugin's `mcp.json` runs `npx -y transcripts-mcp@<pinned version>`.

## Configure

Restart the client after saving. The same launch command is used everywhere:

```bash
npx -y transcripts-mcp
```

### Cursor (`~/.cursor/mcp.json`)

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

Project scope: the same object in `.cursor/mcp.json`.

### Claude Code (`~/.claude.json`)

Add under the top-level `mcpServers` key (user scope):

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

Project scope: the same `mcpServers` object in `.mcp.json` at a repo root. Or:

```bash
claude mcp add --scope user transcripts -- npx -y transcripts-mcp
```

### Codex (`~/.codex/config.toml`)

```toml
[mcp_servers.transcripts]
command = "npx"
args = ["-y", "transcripts-mcp"]
```

Or:

```bash
codex mcp add transcripts -- npx -y transcripts-mcp
```

## How it works

1. You work in Claude Code, Cursor, or Codex. Sessions land as JSONL under `~/.claude`, `~/.cursor`, or `~/.codex`.
2. You switch tools. The new client calls this server.
3. Adapters parse each harness into a shared message shape.
4. `grep_transcripts` scans files immediately. `search_transcripts` ranks over an optional local FTS5 index (`build_index`).

## Tools

| Tool                 | Inputs                                                                                                                              | What it does                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `list_providers`     | (none)                                                                                                                              | Harnesses on this machine, with availability and a capped session file count                      |
| `list_sessions`      | `provider?`, `cwd?`, `since?`, `until?`, `limit?` (1–200, default 50)                                                               | Session summaries, newest first. `since` / `until` are ISO-8601. Does not return full transcripts |
| `get_transcript`     | `provider`, `id`, `path?`, `limit?` (1–1000, default 200)                                                                           | Normalized messages for one session                                                               |
| `grep_transcripts`   | `query`, `mode?` (`plain` \| `regex` \| `fuzzy`, default `fuzzy`), `provider?`, `limit?` (1–200, default 50)                        | Fuzzy / plain / regex over raw JSONL, then adapter-normalized. No index required                  |
| `search_transcripts` | `query`, `mode?` (`fts` \| `hybrid`, default `fts`), `provider?`, `role?`, `cwd?`, `since?`, `until?`, `limit?` (1–100, default 20) | BM25-ranked search over the FTS5 index. `hybrid` after a semantic build                           |
| `build_index`        | `full?`, `semantic?`                                                                                                                | Build or refresh the FTS5 index. `full: true` rebuilds from scratch. `semantic: true` also embeds |

Provider ids: `cursor`, `claude-code`, `codex`.

## Search tiers

1. **grep** (`grep_transcripts`) — `@ff-labs/fff-bun` fuzzy / plain / regex. No index. Falls back to a streaming scan if the native binary fails to load.
2. **FTS5** (`search_transcripts`, `mode: "fts"`) — `bun:sqlite` + `bm25()` over normalized message text. Requires `build_index`.
3. **semantic** (optional) — `build_index` with `semantic: true` downloads ~23 MB ONNX (`all-MiniLM-L6-v2`) on first run. Then `search_transcripts` accepts `mode: "hybrid"` (BM25 + vectors, reciprocal rank fusion). Semantic/hybrid only works when the server runs under Bun; the npx platform binary cannot embed `sqlite-vec` or the ONNX engine.

## Environment

Defaults match a typical install. Set these only to override.

| Variable                | Default                       |
| ----------------------- | ----------------------------- |
| `CURSOR_HOME`           | `~/.cursor`                   |
| `CLAUDE_HOME`           | `~/.claude`                   |
| `CODEX_HOME`            | `~/.codex`                    |
| `TRANSCRIPTS_MCP_INDEX` | `~/.transcripts-mcp/index.db` |

## Safety

Read-only on transcripts. The only write is the search index at `~/.transcripts-mcp/index.db` (or `TRANSCRIPTS_MCP_INDEX`).

## From source

Requires [Bun](https://bun.sh) >= 1.2 and [pnpm](https://pnpm.io).

```bash
pnpm install
bun apps/mcp/src/index.ts
```

or:

```bash
pnpm start
```

stdout is JSON-RPC. Logs go to stderr.

From-source MCP config uses an absolute path to `apps/mcp/src/index.ts`. Windows paths work (`V:/dev/transcripts-mcp/apps/mcp/src/index.ts` or `V:\\dev\\...`).

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

## Workspace

- `apps/mcp` — stdio server, tool registration, adapter wiring
- `apps/www` — marketing site (Vite + React)
- `packages/cli` — published `transcripts-mcp` shim and platform binaries
- `packages/core` — types, adapter contract, jsonl reader, registry
- `packages/adapters` — Cursor, Claude Code, Codex
- `packages/search` — grep (fff), FTS5, optional semantic search
- `distribution/plugin` — Cursor Plugin manifest, skill, and `mcp.json`

See [CONTRIBUTING.md](CONTRIBUTING.md) to add a harness. AI-assisted contributions are welcome; read the [AI Policy](AI_POLICY.md) first.

## License

[MIT](LICENSE)

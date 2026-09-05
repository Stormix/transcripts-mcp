# transcripts-mcp

Local stdio MCP server that queries Cursor, Claude Code, and Codex session transcripts already on disk.

Each harness already writes JSONL as you work. Point any of them at this server and they can list, dump, and search those sessions. Nothing is uploaded; the server only reads local files (plus an optional search index under `~/.transcripts-mcp`).

## What you can ask

Once a client has the server configured:

- What was I working on in my last Cursor session?
- Search my Claude Code transcripts for authentication
- Dump the Codex session from this afternoon
- Which providers have sessions on this machine?

That is searchable transcript text, not the previous session's memory. The other tool still has to read.

## Requirements

- [Bun](https://bun.sh) >= 1.2
- [pnpm](https://pnpm.io)

## Install

From source:

```bash
pnpm install
```

From GitHub Packages (not the public npm registry). Add to `~/.npmrc`:

```
@stormix:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

The token needs `read:packages`. Then:

```bash
npx -y --registry=https://npm.pkg.github.com @stormix/transcripts-mcp
bunx --bun --registry=https://npm.pkg.github.com @stormix/transcripts-mcp
pnpm dlx --registry=https://npm.pkg.github.com @stormix/transcripts-mcp
```

`npx` / `pnpm dlx` spawn the platform binary: native fff grep, FTS5, no semantic/hybrid (`sqlite-vec` and the ONNX engine are not embeddable). `bunx --bun` runs the bundled server in-process and can use semantic/hybrid. If the binary is missing, the shim looks for `bun` on PATH.

## Cursor plugin

This repo is a Cursor Plugin. Install it from Customize, or symlink for local work:

```bash
ln -s /path/to/transcripts-mcp/distribution/plugin ~/.cursor/plugins/local/transcripts-mcp
```

The plugin's `mcp.json` runs `npx -y --registry=https://npm.pkg.github.com @stormix/transcripts-mcp@<pinned version>`. Set the `GITHUB_TOKEN` plugin variable (`read:packages`) so npx can fetch the private package.

## Launch

```bash
bun apps/mcp/src/index.ts
```

or:

```bash
pnpm start
```

stdout is JSON-RPC. Logs go to stderr.

## Configure

Use an absolute path to `apps/mcp/src/index.ts`. Windows paths work (`V:/dev/transcripts-mcp/apps/mcp/src/index.ts` or `V:\\dev\\...`). Restart the client after saving.

The same launch command is used everywhere:

```bash
bun /absolute/path/to/transcripts-mcp/apps/mcp/src/index.ts
```

Or, after a GitHub Packages install:

```bash
npx -y --registry=https://npm.pkg.github.com @stormix/transcripts-mcp
```

### Cursor (`~/.cursor/mcp.json`)

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

Project scope: the same object in `.cursor/mcp.json`.

### Claude Code (`~/.claude.json`)

Add under the top-level `mcpServers` key (user scope):

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

Project scope: the same `mcpServers` object in `.mcp.json` at a repo root. Or:

```bash
claude mcp add --scope user transcripts -- bun /absolute/path/to/transcripts-mcp/apps/mcp/src/index.ts
```

### Codex (`~/.codex/config.toml`)

```toml
[mcp_servers.transcripts]
command = "bun"
args = ["/absolute/path/to/transcripts-mcp/apps/mcp/src/index.ts"]
```

Or:

```bash
codex mcp add transcripts -- bun /absolute/path/to/transcripts-mcp/apps/mcp/src/index.ts
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
3. **semantic** (optional) — `build_index` with `semantic: true` downloads ~23 MB ONNX (`all-MiniLM-L6-v2`) on first run. Then `search_transcripts` accepts `mode: "hybrid"` (BM25 + vectors, reciprocal rank fusion). The server works without this tier.

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

## Workspace

- `apps/mcp` — stdio server, tool registration, adapter wiring
- `packages/cli` — published `@stormix/transcripts-mcp` shim and GitHub Packages artifacts
- `packages/core` — types, adapter contract, jsonl reader, registry
- `packages/adapters` — Cursor, Claude Code, Codex
- `packages/search` — grep (fff), FTS5, optional semantic search
- `distribution/plugin` — Cursor Plugin manifest, skill, and `mcp.json`

See [CONTRIBUTING.md](CONTRIBUTING.md) to add a harness.

> **AI-Assisted Contributions:** We welcome AI-assisted contributions! Please review our [AI Policy](./AI_POLICY.md) for guidelines on disclosure and quality expectations.

## License

MIT

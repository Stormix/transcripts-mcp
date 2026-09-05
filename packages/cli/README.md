# @stormix/transcripts-mcp

Local stdio MCP server for Cursor, Claude Code, and Codex session transcripts.

Published to GitHub Packages (`https://npm.pkg.github.com`), not the public npm registry.

```bash
# ~/.npmrc
@stormix:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

```bash
npx -y --registry=https://npm.pkg.github.com @stormix/transcripts-mcp
bunx --bun --registry=https://npm.pkg.github.com @stormix/transcripts-mcp
pnpm dlx --registry=https://npm.pkg.github.com @stormix/transcripts-mcp
```

`npx` / `pnpm dlx` spawn the platform binary (native fff + FTS; no semantic). `bunx --bun` runs the bundled server in-process and can use semantic/hybrid. If the binary is missing, the shim looks for `bun` on PATH.

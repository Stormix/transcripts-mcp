# transcripts-mcp

Search local Cursor, Claude Code, and Codex session transcripts via MCP

```bash
npx -y transcripts-mcp
bunx --bun transcripts-mcp
pnpm dlx transcripts-mcp
```

`npx` / `pnpm dlx` spawn the platform binary (native fff + FTS; no semantic). `bunx --bun` runs the bundled server in-process and can use semantic/hybrid. If the binary is missing, the shim looks for `bun` on PATH.

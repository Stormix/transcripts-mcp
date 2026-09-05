# Security

The MCP server reads local Cursor, Claude Code, and Codex session files and may write a search index under `~/.transcripts-mcp`. Those files never leave the machine. Do not report a “data exfiltration” finding that is the server reading paths it is designed to read.

## Reporting

Use [GitHub private vulnerability reporting](https://github.com/Stormix/transcripts-mcp/security/advisories/new) on this repository. If that is unavailable, email [hello@stormix.co](mailto:hello@stormix.co).

Include enough to reproduce: affected version or commit, what you ran, and what went wrong. Do not open a public issue for an unpatched vulnerability.

We will acknowledge the report and say what we are doing with it.

## Scope

In scope:

- Path traversal or writes outside the intended index location
- Execution of transcript contents as code
- Secrets from the repo, CI, or the published package
- Supply-chain issues in the release workflow

Out of scope:

- The server listing or searching transcripts on the same machine (that is the product)
- Bugs in Cursor, Claude Code, or Codex themselves
- Denial of service against a local stdio process

# Security

transcripts-mcp reads local Cursor, Claude Code, and Codex transcripts and returns results to the connected MCP client. It does not modify transcript files or upload their contents. The client may send retrieved text to its model provider according to its own settings.

Indexed search writes message text to a local SQLite database. Optional semantic search also stores embeddings and downloads and caches model files.

## Reporting a vulnerability

Use [GitHub private vulnerability reporting](https://github.com/Stormix/transcripts-mcp/security/advisories/new). If it is unavailable, email [hello@stormix.co](mailto:hello@stormix.co).

Include the affected version or commit, steps to reproduce, and the impact. Remove secrets and private transcript contents from examples. Please do not open a public issue for an unpatched vulnerability.

We will acknowledge your report and follow up with our assessment and next steps.

## Scope

Security reports may include:

- Path traversal or writes outside intended storage locations
- Execution of transcript contents as code
- Exposed secrets in the repository, CI, or published package
- Supply-chain issues in the release workflow

Listing and searching local transcripts is the server's intended behavior. Reports should explain how an issue exceeds that access or exposes data unexpectedly.

Issues in Cursor, Claude Code, or Codex should be reported to their maintainers. Denial of service against the local stdio process is outside this security policy's scope.

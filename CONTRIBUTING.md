# Contributing

## Development

Requires [Bun](https://bun.sh) >= 1.2, [Node](https://nodejs.org) >= 24, and [pnpm](https://pnpm.io) 11.

```bash
git clone https://github.com/Stormix/transcripts-mcp.git
cd transcripts-mcp
pnpm install
```

Launch the server from source:

```bash
bun apps/mcp/src/index.ts
```

or:

```bash
pnpm start
```

stdout is JSON-RPC. Logs go to stderr. Point an MCP client at that absolute path (see [README](README.md#from-source)).

## Checks

Run from the repo root before you open a PR:

```bash
pnpm test
pnpm check-types
pnpm lint
pnpm format:check
```

`pnpm lint:fix` and `pnpm format` apply fixes. New features and bug fixes need tests (`*.spec.ts` under `src/tests/`). Changelog-worthy work also needs a changeset (see `.cursor/rules/090-changesets.mdc`).

## AI-Assisted Contributions

We encourage the use of AI tools to help you contribute — we use them ourselves (our Cursor config is in the repo!). Please review our [AI Policy](./AI_POLICY.md) for the full details, but the essentials are:

1. **You own your code.** Understand and be able to explain everything you submit.
2. **Disclose significant AI usage** in your PR description.
3. **PRs must address real issues.** No drive-by AI-generated refactors or bug reports.
4. **Quality is what matters.** Good code is good code, regardless of how it was written.

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). Report vulnerabilities through [SECURITY.md](SECURITY.md), not a public issue.

## Add a new harness

Grep, FTS5, and semantic search come for free. Do not put search code in the adapter.

1. Add one file in `packages/adapters/src/` that calls `defineJsonlAdapter` with `{ id, displayName, root, sessionFiles, sessionIdFromPath, lineSchema, toMessage }`.
2. Add the adapter to `allAdapters` in `packages/adapters/src/index.ts`.
3. Add one anonymized fixture and a `*.spec.ts` under `packages/adapters/src/tests/`.

`apps/mcp` registers `allAdapters`. No other wiring.

### `defineJsonlAdapter`

```ts
export const exampleAdapter = defineJsonlAdapter({
  id: "example",
  displayName: "Example",
  root: () => process.env.EXAMPLE_HOME ?? join(homedir(), ".example"),
  sessionFiles: "projects/*/*.jsonl",
  sessionIdFromPath: (path) => basename(path, ".jsonl"),
  lineSchema: exampleLineSchema,
  toMessage: (line) => ({ role: line.role, text: line.text }),
});
```

Optional: `titleFromLine`, `cwdFromLine`, `timestampFromLine`.

`sessionFiles` is walked by `walkGlob`, which matches per path segment. `*` is allowed. `**` is not. Depth must match the pattern (`projects/*/*.jsonl`, not `projects/**/*.jsonl`).

### Parsing

`lineSchema` is a Zod schema for one JSONL line. Core runs `JSON.parse` then `safeParse`. `toMessage` receives the narrowed type and returns `{ role, text, timestamp?, toolName? }` or `null`.

Unrecognized shapes are skipped. Invalid JSON and throws inside `toMessage` increment `session.parseErrors`.

Anti-slop: schema-driven parsing only. No `unknown` parameters, no `typeof` guards, no `Record<string, unknown>` bags.

### Tests

Place an anonymized fixture under `packages/adapters/src/tests/fixtures/<id>/` using the same layout as `sessionFiles`. Specs live next to it as `src/tests/<id>.spec.ts`, named `should [outcome] when [condition]`.

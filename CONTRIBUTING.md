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

## Before opening a pull request

Link the issue or discussion your change addresses. For new work or refactors, discuss the approach with the maintainers first.

Review and test your changes before submitting them. If you used AI beyond autocomplete or minor editing, include a short disclosure in the PR description. See the [AI Policy](AI_POLICY.md) for details.

Follow the [Code of Conduct](CODE_OF_CONDUCT.md). Report vulnerabilities through [SECURITY.md](SECURITY.md).

## Add a new harness

Adapters convert provider transcripts into the shared message format. Search is handled by the search package.

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

Use schema-driven parsing. Do not use `unknown` parameters, `typeof` guards, or `Record<string, unknown>` objects.

### Tests

Place an anonymized fixture under `packages/adapters/src/tests/fixtures/<id>/` using the same layout as `sessionFiles`. Specs live next to it as `src/tests/<id>.spec.ts`, named `should [outcome] when [condition]`.

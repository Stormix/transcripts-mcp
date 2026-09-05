# Contributing

## AI-Assisted Contributions

We encourage the use of AI tools to help you contribute — we use them ourselves (our Cursor config is in the repo!). Please review our [AI Policy](./AI_POLICY.md) for the full details, but the essentials are:

1. **You own your code.** Understand and be able to explain everything you submit.
2. **Disclose significant AI usage** in your PR description.
3. **PRs must address real issues.** No drive-by AI-generated refactors or bug reports.
4. **Quality is what matters.** Good code is good code, regardless of how it was written.

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

## Checks

```bash
pnpm test
pnpm check-types
pnpm lint
pnpm format:check
```

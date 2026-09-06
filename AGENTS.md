# Instructions for AI Agents

This file provides guidance for AI coding agents (Claude Code, Cursor Agent, Copilot Workspace, Windsurf, etc.) operating on this codebase.

## Before You Begin

1. Check the `.cursor/rules` directory for relevant guidance before starting any task.
2. Read [CONTRIBUTING.md](./CONTRIBUTING.md) and understand the project's conventions.
3. Read the [AI Policy](./AI_POLICY.md) — contributions must comply with it.
4. Familiarize yourself with the project structure in [020-codebase-structure.mdc](.cursor/rules/020-codebase-structure.mdc).

## Project Context

transcripts-mcp is a TypeScript pnpm + Turborepo for a local stdio MCP server that queries agent session transcripts.

Key directories:

- `apps/mcp` — stdio MCP server, tool registration, adapter wiring
- `apps/www` — marketing site (Vite + React), deployed with wrangler
- `packages/core` — types, adapter contract, jsonl reader, registry
- `packages/contracts` — serializable MCP tool metadata shared by runtime and docs
- `packages/adapters` — Cursor, Claude Code, and Codex harness adapters
- `packages/search` — grep (fff), FTS5, optional semantic search
- `tools/typescript-config` — shared tsconfig
- `tools/oxlint-plugins` — custom oxlint rules (`anti-slop`)
- `distribution/plugin` — Cursor Plugin manifest, skill, and `mcp.json`

## Rules for AI Agents

### DO

- Help the human contributor understand code and debug issues
- Suggest improvements that follow existing patterns in the codebase
- Write tests for new and existing functionality
- Use oxfmt for formatting and oxlint for linting (not ESLint/Prettier/Biome)
- Follow the existing commit convention: `type(scope): description` (see [.agents/skills/git-conventions/SKILL.md](.agents/skills/git-conventions/SKILL.md)); commit on the current branch unless the user asks to use a feature branch
- Before pushing, fetch the upstream branch. If it has advanced, rebase unpublished local commits onto it, including when working on `main`, then push normally. Keep history linear; do not create merge commits or bypass branch protection to push. Rewriting already-published history requires explicit user authorization.
- Respect TypeScript strict mode — never use `any` or `unknown`, use proper types (see 031-never-use-any.mdc)
- Cross-package imports use the workspace package name (`@transcripts-mcp/*`), never relative paths
- Tests are `*.spec.ts` under `src/tests/`, never `__tests__` or `*.test.ts`
- When a plan, design doc, or PR description covers a real call-flow change that a tree would help reviewers understand, optionally include a `npx calldiff@latest diff` (see [095-calldiff.mdc](.cursor/rules/095-calldiff.mdc)). Do not add call-stack diffs to routine chat summaries.

### DON'T

- Generate entire pull requests autonomously
- Open issues based on static analysis without human verification
- Refactor code without prior discussion with maintainers
- Add new dependencies without justification
- Introduce patterns that don't already exist in the codebase without discussion
- Submit code that the human operator cannot explain or modify

### Code Quality Checklist

Before the human submits your work, ensure:

- [ ] `pnpm lint:fix` and `pnpm format` have been run
- [ ] `pnpm knip` passes
- [ ] `pnpm check-types` passes
- [ ] Changes are tested (manually at minimum, automated tests preferred)
- [ ] PR description explains _what_ and _why_, not just _how_
- [ ] AI usage is disclosed per the [AI Policy](./AI_POLICY.md)

## Tech Stack Quick Reference

| Layer            | Technology                              |
| ---------------- | --------------------------------------- |
| Runtime          | Bun                                     |
| Language         | TypeScript                              |
| MCP server       | `apps/mcp` (stdio)                      |
| Package Manager  | pnpm (monorepo)                         |
| Build System     | Turborepo                               |
| Linter/Formatter | oxlint + oxfmt                          |
| Tests            | Vitest (`*.spec.ts` under `src/tests/`) |
| Search           | fff, FTS5, optional semantic            |

## Commands

```bash
pnpm install
pnpm dev                    # start apps via turbo
pnpm check-types
pnpm lint
pnpm format
pnpm knip
pnpm test
```

## Cursor Cloud specific instructions

The repository pins Node 26.8.1, pnpm 12.3.3, and Bun 1.4.0 in `.tool-versions`.
Cloud images may expose a different Node version first on `PATH`; install or activate the
repository pin before running project commands. The `install` step runs
`pnpm install --frozen-lockfile` after activation.

Cloud Agent tool-call shells are non-interactive and do not source `~/.bashrc`, and the
exec-daemon prepends its own Node 22 to `PATH`. A bare `node` therefore resolves to Node 22,
which breaks `pnpm lint` (oxlint loads the `@transcripts-mcp/oxlint-plugins` TypeScript plugin,
which needs Node 26 type-stripping). Activate the project toolchain before running any pnpm
command:

```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm install >/dev/null; nvm use >/dev/null
corepack prepare pnpm@12.3.3 --activate
export PATH="$(dirname "$(nvm which 26.8.1)"):$HOME/.bun/bin:$PATH"
```

With that preamble, `pnpm install`, `pnpm check-types`, `pnpm test`, `pnpm lint`, and
`bun apps/mcp/src/index.ts` run against the checked Node and pnpm pins. Ensure Bun 1.4.0 is
installed when the image's bundled Bun differs.

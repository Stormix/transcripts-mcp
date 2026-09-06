---
name: simplify
description: Simplify scoped code with parallel read-only review subagents, then apply targeted cleanup fixes without a large refactor.
---

# Simplify

Run three parallel read-only reviewers on a scoped diff, aggregate their findings, then make targeted cleanup edits yourself. The goal is less complexity and better reuse — not a rewrite.

Project skill: `.agents/skills/simplify/SKILL.md`

## When to use

- After `/simplify` or when asked to simplify code, reduce complexity, or clean up a diff.
- Before review when a change works but feels heavier than it needs to be.
- When you want parallel review passes (quality, performance, reuse) without handing edits to subagents.

## Scope selection

1. Explicit paths, symbols, diff, or area the user named.
2. Otherwise: combined `git diff` + `git diff --cached`.
3. If no local diff: files or symbols mentioned in the conversation.
4. Last resort: `git show HEAD`.
5. Do not broaden scope beyond the selected work unless needed to understand local patterns.

## Subagents (read-only, parallel)

Launch all three with the same model as the parent. They report only — no edits, formatters, worktrees, or commits.

**Code quality** — low-information comments, one-off helpers, nullable proliferation, catch-all try/catch, premature abstraction, weak type escapes, duplicated or derived state, dead compatibility code.

**Performance** — blocking hot-path work, uncached expensive ops, busy waits, string concat in loops, N+1 I/O, chatty logging in tight loops.

**Reuse** — existing helpers or patterns elsewhere in the codebase or already in the diff.

## Fixing

- Aggregate findings and fix what clearly reduces complexity or improves reuse.
- Skip issues that need more user context or a refactor much larger than the original diff; note those in the summary.
- Run lightweight checks on touched files when practical.

## Output should feel like

- A short summary: what was fixed, what was skipped but recommended.
- Behavior preserved unless a clear bug was fixed.
- Edits stay inside the selected scope.

## Related

- [[deslop]] — strip AI-generated slop from a branch diff.
- [[thermo-nuclear-code-quality-review]] — deeper structural review when simplification isn't enough.
- [[improve-codebase-architecture]] — longer-horizon architecture opportunities.
- [[skills-index]] — vault catalog.

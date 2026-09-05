---
name: calldiff
description: Generate call-stack diffs with `npx calldiff@latest` and include them when writing a plan, design doc, ADR, PR description, commit body, or summary of a code change, so reviewers can see how call flow changed. Use whenever a change rewires who-calls-whom and a line diff would bury the shape of the change.
---

# Call-stack diffs with calldiff

When documenting a change to control flow, generate a call-stack diff with `npx calldiff@latest` and paste it next to the prose it supports. Line diffs bury who-calls-whom; the ASCII tree is what reviewers need.

For choosing a call tree over other visuals, see [show-me](../show-me/SKILL.md).

## When to use

Include a calldiff in any plan, design doc, ADR, PR description, commit body, or chat summary that describes a change to control flow.

Skip it for content, config, docs, or edits that leave call flow untouched.

## Commands

HEAD vs working tree:

```bash
npx calldiff@latest diff
```

One ref vs working tree, or two refs:

```bash
npx calldiff@latest diff main
npx calldiff@latest diff --from main --to feature
```

Pin entrypoints and scope to a package in this monorepo:

```bash
npx calldiff@latest diff -e createLogger -e ClassName.method -- packages/core
npx calldiff@latest diff -F packages/core/src/index.ts
```

Current shape (no diff) and path questions:

```bash
npx calldiff@latest tree -e createLogger
npx calldiff@latest reach -e createLogger --to emit
```

Optional flags: `--locs` for call-site `file:line`, `--format json|yaml|md|jsonl` for structured output.

## How to include the output

Paste the ASCII tree in a `diff` fenced block next to the prose it supports. Trim to the entrypoints a reviewer cares about; do not dump full depth.

```diff
 submitForm
   createSession
     persistPrompt
+    expandSkillMention
     launchAgent
-  navigateToSession
+  navigateToSession
+    subscribeToEvents
```

## Limits

- Syntactic only: dynamic and indirect calls do not resolve.
- Requires committed or working-tree-resolvable code. Grammars download on first use.
- Hand-write the tree for hypothetical or unresolvable flow and label it as such.

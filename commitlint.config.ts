import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const META_SCOPES: string[] = ["deps", "repo", "release"];
const WORKSPACE_ROOTS: string[] = ["apps", "packages", "tools", "distribution"];

function workspaceScopes(cwd: string): string[] {
  const scopes: string[] = [];

  for (const root of WORKSPACE_ROOTS) {
    const dir = join(cwd, root);
    if (!existsSync(dir)) {
      continue;
    }

    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }

      if (existsSync(join(dir, entry.name, "package.json"))) {
        scopes.push(entry.name);
      }
    }
  }

  return scopes;
}

function scopeEnum(): [2, "always", string[]] {
  return [2, "always", [...workspaceScopes(process.cwd()), ...META_SCOPES]];
}

const scopeCase: [2, "always", "kebab-case"] = [2, "always", "kebab-case"];

const config = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": scopeEnum,
    "scope-case": scopeCase,
  },
};

export default config;

import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createRegistry } from "@transcripts-mcp/core";

import { buildIndex, searchTranscripts } from "../fts.ts";
import {
  createFixtureAdapter,
  createFixtureRoot,
  createSlugFixtureAdapter,
  messageLine,
  removeFixtureRoot,
  writeSession,
  writeSlugSession,
} from "./helpers.ts";

const root = await createFixtureRoot();
const indexDir = await mkdtemp(join(tmpdir(), "transcripts-index-"));
process.env.TRANSCRIPTS_MCP_INDEX = join(indexDir, "index.db");

try {
  await writeSession(root, "alpha", [
    messageLine("user", "unique-fts-term zebra about indexing"),
    messageLine("assistant", "acknowledged"),
  ]);
  await writeSession(root, "beta", [
    messageLine("user", "unrelated conversation about weather"),
    messageLine("assistant", "the sky is blue"),
  ]);
  await writeSession(root, "cwd-sess", [
    messageLine("user", "cwd-term lives here", "/tmp/demo"),
    messageLine("assistant", "cwd acknowledged"),
  ]);
  await writeSlugSession(root, "v-dev-transcripts-mcp", "slug-sess", [
    messageLine("user", "vitest bench for the mcp"),
    messageLine("assistant", "slug acknowledged"),
  ]);

  const registry = createRegistry([createFixtureAdapter(root), createSlugFixtureAdapter(root)]);
  const built = await buildIndex(registry, { full: true });
  const hits = await searchTranscripts(registry, {
    query: "unique-fts-term",
    mode: "fts",
  });
  const top = hits[0];
  if (built.messages <= 0 || built.semantic || top === undefined) {
    throw new Error("FTS index did not produce a ranked hit");
  }
  if (
    !top.text.includes("unique-fts-term") ||
    top.sessionId !== "alpha" ||
    top.provider !== "fixture"
  ) {
    throw new Error(`unexpected top hit: ${top.sessionId} ${top.text}`);
  }

  const cwdHits = await searchTranscripts(registry, {
    query: "cwd-term",
    mode: "fts",
    cwd: "/tmp/demo",
  });
  const slashCwdHits = await searchTranscripts(registry, {
    query: "cwd-term",
    mode: "fts",
    cwd: "\\tmp\\demo",
  });
  const slugHits = await searchTranscripts(registry, {
    query: "vitest",
    mode: "fts",
    cwd: "V:\\dev\\transcripts-mcp",
  });
  const roleUserHits = await searchTranscripts(registry, {
    query: "unique-fts-term",
    mode: "fts",
    role: "user",
  });
  const roleAssistantHits = await searchTranscripts(registry, {
    query: "unique-fts-term",
    mode: "fts",
    role: "assistant",
  });

  if (cwdHits.length !== 1 || cwdHits[0]?.sessionId !== "cwd-sess") {
    throw new Error(`cwd filter missed: ${cwdHits.map((hit) => hit.sessionId).join(",")}`);
  }
  if (slugHits.length !== 1 || slugHits[0]?.sessionId !== "slug-sess") {
    throw new Error(`slug filter missed: ${slugHits.map((hit) => hit.sessionId).join(",")}`);
  }
  if (roleUserHits.length !== 1 || roleAssistantHits.length !== 0) {
    throw new Error(
      `role filter missed: user=${roleUserHits.length} assistant=${roleAssistantHits.length}`,
    );
  }

  console.info(
    `FTS_RESULT:${JSON.stringify({
      ok: true,
      text: top.text,
      sessionId: top.sessionId,
      provider: top.provider,
      messages: built.messages,
      cwdHits: cwdHits.length,
      slashCwdHits: slashCwdHits.length,
      slugHits: slugHits.length,
      roleUserHits: roleUserHits.length,
    })}`,
  );
} finally {
  await removeFixtureRoot(root);
  await removeFixtureRoot(indexDir);
}

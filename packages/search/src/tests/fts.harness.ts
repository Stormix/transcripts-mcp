import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildIndex, searchTranscripts } from "../fts.ts";
import {
  createFixtureRegistry,
  createFixtureRoot,
  messageLine,
  removeFixtureRoot,
  writeSession,
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

  const registry = createFixtureRegistry(root);
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
  console.info(
    `FTS_RESULT:${JSON.stringify({
      ok: true,
      text: top.text,
      sessionId: top.sessionId,
      provider: top.provider,
      messages: built.messages,
    })}`,
  );
} finally {
  await removeFixtureRoot(root);
  await removeFixtureRoot(indexDir);
}

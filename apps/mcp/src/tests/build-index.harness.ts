import { Database } from "bun:sqlite";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { setImmediate } from "node:timers/promises";

import { InMemoryTransport, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { createRegistry, defineJsonlAdapter } from "@transcripts-mcp/core";

import { registerBuildIndex } from "../tools/build-index.ts";

const root = await mkdtemp(join(tmpdir(), "transcripts-build-tool-"));
process.env.TRANSCRIPTS_MCP_INDEX = join(root, "index.db");
const lineSchema = z.object({ text: z.string() });
const adapter = defineJsonlAdapter({
  id: "fixture",
  displayName: "Fixture",
  root: () => root,
  sessionFiles: "*.jsonl",
  sessionIdFromPath: (path) => basename(path, ".jsonl"),
  lineSchema,
  toMessage: (line) => ({ role: "user", text: line.text }),
});
const progressSchema = z.object({
  method: z.literal("notifications/progress"),
  params: z.object({ progressToken: z.number(), progress: z.number(), message: z.string() }),
});
const resultSchema = z.object({
  id: z.literal(2),
  result: z.object({
    isError: z.boolean().optional(),
    content: z.array(z.object({ text: z.string() })),
  }),
});

try {
  await writeFile(
    join(root, "session.jsonl"),
    JSON.stringify({ text: "private transcript content" }),
  );
  await verifyBuild(true, false);
  await verifyBuild(false, false);
  await writeFile(join(root, "session.jsonl"), JSON.stringify({ text: "cancelled replacement" }));
  await verifyBuild(true, true);
  console.info("BUILD_INDEX_TOOL_OK");
} finally {
  await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
}

async function verifyBuild(withProgress: boolean, cancel: boolean): Promise<void> {
  const server = new McpServer({ name: "test", version: "1.0.0" });
  const [client, serverTransport] = InMemoryTransport.createLinkedPair();
  const initialized = Promise.withResolvers<void>();
  const completed = Promise.withResolvers<void>();
  let toolResult: z.infer<typeof resultSchema>["result"] | undefined;
  registerBuildIndex(
    server,
    createRegistry([
      {
        ...adapter,
        async isAvailable() {
          if (cancel) {
            await client.send({
              jsonrpc: "2.0",
              method: "notifications/cancelled",
              params: { requestId: 2 },
            });
          }
          return true;
        },
        async *listSessions(options) {
          try {
            yield* adapter.listSessions(options);
          } finally {
            if (cancel) completed.resolve();
          }
        },
      },
    ]),
  );
  const progress: z.infer<typeof progressSchema>["params"][] = [];
  client.onmessage = async (message) => {
    if (z.object({ id: z.literal(1) }).safeParse(message).success) initialized.resolve();
    const notification = progressSchema.safeParse(message);
    if (notification.success) {
      progress.push(notification.data.params);
    }
    const result = resultSchema.safeParse(message);
    if (result.success) {
      toolResult = result.data.result;
      completed.resolve();
    }
  };
  const timeout = setTimeout(
    () => completed.reject(new Error("MCP build did not complete")),
    10_000,
  );
  try {
    await server.connect(serverTransport);
    await client.start();
    await client.send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "test", version: "1.0.0" },
      },
    });
    await initialized.promise;
    await client.send({ jsonrpc: "2.0", method: "notifications/initialized" });
    await client.send({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "build_index",
        arguments: { full: true },
        _meta: withProgress ? { progressToken: 0 } : undefined,
      },
    });
    await completed.promise;
    await setImmediate();
    if (cancel) {
      assert.equal(progress.length, 1);
      const db = new Database(process.env.TRANSCRIPTS_MCP_INDEX, { readonly: true });
      try {
        assert.deepEqual(db.query("SELECT text FROM messages_fts").all(), [
          { text: "private transcript content" },
        ]);
      } finally {
        db.close();
      }
    } else if (withProgress) {
      assert.ok(toolResult);
      assert.equal(toolResult.isError, undefined);
      assert.ok(progress.length >= 2);
      assert.ok(progress.at(-1)?.message.startsWith("complete:"));
    } else {
      assert.equal(progress.length, 0);
    }
    let previous = -1;
    for (const notification of progress) {
      assert.equal(notification.progressToken, 0);
      assert.ok(notification.progress > previous);
      assert.ok(!notification.message.includes("private transcript"));
      assert.ok(!notification.message.includes(root));
      previous = notification.progress;
    }
  } finally {
    clearTimeout(timeout);
    await server.close();
    await client.close();
  }
}

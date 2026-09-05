import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createRegistry } from "../registry.ts";
import { createTestAdapter } from "./test-adapter";

const fixturesDir = join(import.meta.dirname, "fixtures");

describe("AdapterRegistry", () => {
  it("should resolve an adapter by file path", () => {
    const registry = createRegistry();
    const adapter = createTestAdapter(fixturesDir);
    registry.register(adapter);

    expect(registry.resolveByPath(join(fixturesDir, "skip-unrecognized.jsonl"))?.id).toBe("test");
    expect(registry.resolveByPath(join(fixturesDir, "..", "..", "outside.jsonl"))).toBeUndefined();
  });

  it("should prefer the adapter with the longest matching root", () => {
    const registry = createRegistry();
    registry.register(createTestAdapter(join(fixturesDir, ".."), "fixtures/*.jsonl"));
    registry.register({
      ...createTestAdapter(fixturesDir),
      id: "nested",
      displayName: "Nested",
    });

    expect(registry.resolveByPath(join(fixturesDir, "parse-errors.jsonl"))?.id).toBe("nested");
  });
});

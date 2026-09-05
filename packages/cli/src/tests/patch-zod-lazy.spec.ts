import { describe, expect, it } from "vitest";

import { patchZodLazyInit } from "../patch-zod-lazy.ts";

const bundled = `var init_schemas2 = __esm(() => {});
function lazy(getter) {
  return new ZodLazy({
    type: "lazy",
    getter
  });
}
`;

describe("patchZodLazyInit", () => {
  it("should call init_schemas2 before constructing ZodLazy", () => {
    const patched = patchZodLazyInit(bundled);
    expect(patched).toContain("function lazy(getter) {\n  init_schemas2();\n  return new ZodLazy(");
  });

  it("should be idempotent when the bundle is already patched", () => {
    const patched = patchZodLazyInit(bundled);
    expect(patchZodLazyInit(patched)).toBe(patched);
  });

  it("should throw when the lazy factory is missing", () => {
    expect(() => patchZodLazyInit("var init_schemas2 = 1;")).toThrow(/lazy factory not found/);
  });
});

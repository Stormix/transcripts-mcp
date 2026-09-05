const lazyFactory = /function lazy\(getter\) \{\r?\n  return new ZodLazy\(/;
const alreadyPatched =
  /function lazy\(getter\) \{\r?\n  init_schemas2\(\);\r?\n  return new ZodLazy\(/;

export function patchZodLazyInit(source: string): string {
  if (alreadyPatched.test(source)) return source;
  if (!source.includes("var init_schemas2")) {
    throw new Error("bundled zod is missing init_schemas2; update the lazy patch");
  }
  if (!lazyFactory.test(source)) {
    throw new Error("bundled zod lazy factory not found; update the lazy patch");
  }
  return source.replace(
    lazyFactory,
    "function lazy(getter) {\n  init_schemas2();\n  return new ZodLazy(",
  );
}

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/src/tests/**/*.spec.ts"],
    benchmark: {
      include: ["**/src/tests/**/*.bench.ts"],
    },
    passWithNoTests: true,
  },
});

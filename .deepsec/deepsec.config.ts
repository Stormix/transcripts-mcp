import { defineConfig } from "deepsec/config";

import { generatedMatchersPlugin } from "./generated-matchers.js";

export default defineConfig({
  defaultThinkingLevel: "xhigh", // <deepsec:default-thinking-level>
  defaultModel: "gpt-5.6-sol", // <deepsec:default-model>
  defaultAgent: "codex", // <deepsec:default-agent>
  ai: { mode: "local", provider: "local" }, // <deepsec:model-route>
  projects: [
    { id: "transcripts-mcp", root: ".." },
    // <deepsec:projects-insert-above>
  ],
  plugins: [generatedMatchersPlugin],
});

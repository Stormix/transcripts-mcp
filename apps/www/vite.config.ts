import path from "node:path";
import { fileURLToPath } from "node:url";

import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { pageIds } from "./src/lib/page.ts";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tanstackStart({
      prerender: { enabled: true, crawlLinks: false, autoStaticPathsDiscovery: false },
      pages: pageIds.map((page) => ({ path: page === "home" ? "/" : `/${page}/` })),
    }),
    react(),
    tailwindcss(),
  ],
  resolve: { alias: { "@": path.resolve(root, "src") } },
});

import path from "node:path";
import { fileURLToPath } from "node:url";

import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { createServer, defineConfig, type HtmlTagDescriptor, type Plugin } from "vite";

import { pageFromHtmlFilename, type PageId } from "./src/lib/page";
import {
  ogImageAlt,
  ogImageHeight,
  ogImageUrl,
  ogImageWidth,
  seoForPage,
  siteName,
  themeColor,
  type PageSeo,
} from "./src/lib/seo";

const root = fileURLToPath(new URL(".", import.meta.url));

function htmlSeo(): Plugin {
  return {
    name: "html-seo",
    async transformIndexHtml(html, ctx) {
      const page = pageFromHtmlFilename(ctx.filename);
      const server = await createServer({
        configFile: false,
        root,
        plugins: [react()],
        resolve: { alias: { "@": path.resolve(root, "src") } },
        server: { middlewareMode: true },
        appType: "custom",
      });
      try {
        const { render }: { render: (page: PageId) => string } =
          await server.ssrLoadModule("/src/render.tsx");
        return {
          html: html.replace('<div id="root"></div>', () => `<div id="root">${render(page)}</div>`),
          tags: seoTags(seoForPage(page)),
        };
      } finally {
        await server.close();
      }
    },
  };
}

function seoTags(seo: PageSeo): HtmlTagDescriptor[] {
  return [
    {
      tag: "link",
      attrs: { rel: "alternate", type: "text/markdown", href: `${seo.canonical}index.md` },
    },
    { tag: "link", attrs: { rel: "describedby", href: "/llms.txt" } },
    { tag: "title", children: seo.title },
    { tag: "meta", attrs: { name: "description", content: seo.description } },
    {
      tag: "meta",
      attrs: { name: "robots", content: "index, follow, max-image-preview:large" },
    },
    { tag: "meta", attrs: { name: "author", content: "Stormix" } },
    { tag: "meta", attrs: { name: "theme-color", content: themeColor } },
    { tag: "meta", attrs: { name: "color-scheme", content: "dark" } },
    { tag: "link", attrs: { rel: "canonical", href: seo.canonical } },
    { tag: "link", attrs: { rel: "apple-touch-icon", href: "/apple-touch-icon.png" } },
    { tag: "link", attrs: { rel: "icon", type: "image/png", sizes: "512x512", href: "/logo.png" } },
    { tag: "meta", attrs: { property: "og:type", content: "website" } },
    { tag: "meta", attrs: { property: "og:site_name", content: siteName } },
    { tag: "meta", attrs: { property: "og:locale", content: "en_US" } },
    { tag: "meta", attrs: { property: "og:url", content: seo.canonical } },
    { tag: "meta", attrs: { property: "og:title", content: seo.title } },
    { tag: "meta", attrs: { property: "og:description", content: seo.description } },
    { tag: "meta", attrs: { property: "og:image", content: ogImageUrl } },
    { tag: "meta", attrs: { property: "og:image:alt", content: ogImageAlt } },
    { tag: "meta", attrs: { property: "og:image:type", content: "image/png" } },
    { tag: "meta", attrs: { property: "og:image:width", content: ogImageWidth } },
    { tag: "meta", attrs: { property: "og:image:height", content: ogImageHeight } },
    { tag: "meta", attrs: { name: "twitter:card", content: "summary_large_image" } },
    { tag: "meta", attrs: { name: "twitter:title", content: seo.title } },
    { tag: "meta", attrs: { name: "twitter:description", content: seo.description } },
    { tag: "meta", attrs: { name: "twitter:image", content: ogImageUrl } },
    { tag: "meta", attrs: { name: "twitter:image:alt", content: ogImageAlt } },
    { tag: "script", attrs: { type: "application/ld+json" }, children: seo.jsonLd },
  ];
}

export default defineConfig({
  plugins: [htmlSeo(), react(), tailwindcss(), cloudflare()],
  resolve: {
    alias: {
      "@": path.resolve(root, "./src"),
    },
  },
  environments: {
    client: {
      build: {
        rollupOptions: {
          input: {
            about: path.resolve(root, "about/index.html"),
            contact: path.resolve(root, "contact/index.html"),
            developers: path.resolve(root, "developers/index.html"),
            main: path.resolve(root, "index.html"),
            privacy: path.resolve(root, "privacy/index.html"),
            faq: path.resolve(root, "faq/index.html"),
          },
        },
      },
    },
  },
});

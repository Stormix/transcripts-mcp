import type { PageId } from "./page";

import {
  ogImageAlt,
  ogImageHeight,
  ogImageUrl,
  ogImageWidth,
  seoForPage,
  siteName,
  themeColor,
} from "./seo";

export function headForPage(page: PageId) {
  const seo = seoForPage(page);
  return {
    meta: [
      { title: seo.title },
      { name: "description", content: seo.description },
      { name: "robots", content: "index, follow, max-image-preview:large" },
      { name: "author", content: "Stormix" },
      { name: "theme-color", content: themeColor },
      { name: "color-scheme", content: "dark" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: siteName },
      { property: "og:locale", content: "en_US" },
      { property: "og:url", content: seo.canonical },
      { property: "og:title", content: seo.title },
      { property: "og:description", content: seo.description },
      { property: "og:image", content: ogImageUrl },
      { property: "og:image:alt", content: ogImageAlt },
      { property: "og:image:type", content: "image/png" },
      { property: "og:image:width", content: ogImageWidth },
      { property: "og:image:height", content: ogImageHeight },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: seo.title },
      { name: "twitter:description", content: seo.description },
      { name: "twitter:image", content: ogImageUrl },
      { name: "twitter:image:alt", content: ogImageAlt },
    ],
    links: [
      { rel: "canonical", href: seo.canonical },
      { rel: "alternate", type: "text/markdown", href: `${seo.canonical}index.md` },
      { rel: "describedby", href: "/llms.txt" },
      { rel: "service-desc", type: "application/vnd.oai.openapi+json", href: "/openapi.json" },
      { rel: "service-doc", href: "/developers/" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/logo.png" },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
    ],
    scripts: [{ type: "application/ld+json", children: seo.jsonLd }],
  };
}

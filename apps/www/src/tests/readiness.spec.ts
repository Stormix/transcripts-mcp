import { describe, expect, it } from "vitest";

import { markdownForPage } from "../lib/markdown";
import { negotiate } from "../lib/negotiate";
import { pageIds, pageFromHtmlFilename, pageFromPath } from "../lib/page";
import { seoForPage } from "../lib/seo";
import worker from "../worker";

const assets = {
  ASSETS: {
    fetch: async () => new Response("asset", { headers: { "Content-Type": "text/html" } }),
  },
};

describe("content negotiation", () => {
  it.each([
    [null, "html"],
    ["*/*", "html"],
    ["text/markdown", "markdown"],
    ["text/html", "html"],
    ["application/json", null],
    ["text/markdown;q=0, text/html;q=0", null],
    ["text/markdown;q=0.2, text/html;q=0.8", "html"],
    ["text/html;q=0.2, text/markdown;q=0.8", "markdown"],
    ["text/markdown;q=0, */*;q=1", "html"],
    ["text/html;q=0, text/*;q=0.5", "markdown"],
    ["text/markdown;q=invalid", null],
    ["text/markdown;q=2", null],
    ["TEXT/MARKDOWN; charset=utf-8", "markdown"],
  ])("should select %s correctly when negotiating", (accept, expected) => {
    expect(negotiate(accept)).toBe(expected);
  });
});

describe("public pages", () => {
  it.each(pageIds)("should expose HTML and markdown when requesting %s", async (page) => {
    const base = page === "home" ? "/" : `/${page}/`;
    expect(pageFromPath(base)).toBe(page);
    expect(pageFromHtmlFilename(`/checkout${base}index.html`)).toBe(page);
    expect(seoForPage(page).canonical).toBe(`https://transcriptsmcp.dev${base}`);
    for (const accept of ["text/html", "text/markdown"]) {
      const response = await worker.fetch(
        new Request(`https://transcriptsmcp.dev${base}`, { headers: { Accept: accept } }),
        assets,
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain(accept);
      expect(response.headers.get("Vary")).toContain("Accept");
      expect(response.headers.get("Link")).toContain(`${base}index.md`);
    }
    const markdown = await worker.fetch(
      new Request(`https://transcriptsmcp.dev${base}index.md`),
      assets,
    );
    expect(await markdown.text()).toBe(markdownForPage(page));
    expect(markdownForPage(page).length).toBeGreaterThan(500);
    expect(markdownForPage(page)).toMatch(/^# /);
    const head = await worker.fetch(
      new Request(`https://transcriptsmcp.dev${base}`, {
        method: "HEAD",
        headers: { Accept: "text/markdown" },
      }),
      assets,
    );
    expect(await head.text()).toBe("");
    const unsupported = await worker.fetch(
      new Request(`https://transcriptsmcp.dev${base}`, { headers: { Accept: "application/json" } }),
      assets,
    );
    expect(unsupported.status).toBe(406);
    expect(unsupported.headers.get("Vary")).toContain("Accept");
  });

  it("should redirect to the canonical page when requesting a page alias", async () => {
    for (const path of ["/developers", "/developers/index.html"]) {
      const response = await worker.fetch(
        new Request(`https://transcriptsmcp.dev${path}?example=1`),
        assets,
      );
      expect(response.status).toBe(308);
      expect(response.headers.get("Location")).toBe(
        "https://transcriptsmcp.dev/developers/?example=1",
      );
    }
  });

  it("should give recovery links and noindex when an asset does not exist", async () => {
    const missing = { ASSETS: { fetch: async () => new Response(null, { status: 404 }) } };
    for (const method of ["GET", "HEAD"]) {
      const response = await worker.fetch(
        new Request("https://transcriptsmcp.dev/not-a-page", { method }),
        missing,
      );
      expect(response.status).toBe(404);
      expect(response.headers.get("Content-Type")).toContain("text/markdown");
      expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
      const body = await response.text();
      if (method === "GET") expect(body).toContain("sitemap.xml");
      else expect(body).toBe("");
    }
  });

  it("should preserve assets and reject mutations when requesting the site", async () => {
    const response = await worker.fetch(new Request("https://transcriptsmcp.dev/logo.png"), assets);
    expect(await response.text()).toBe("asset");
    const post = await worker.fetch(
      new Request("https://transcriptsmcp.dev/", { method: "POST" }),
      assets,
    );
    expect(post.status).toBe(405);
    expect(post.headers.get("Allow")).toBe("GET, HEAD");
  });
});

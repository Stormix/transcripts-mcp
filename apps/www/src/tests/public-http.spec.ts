import { env } from "node:process";

import { describe, expect, it } from "vitest";

import { pageIds } from "../lib/page";

const origin = env.WWW_TEST_URL;

describe.skipIf(!origin)("built public HTTP endpoints", () => {
  it.each(pageIds)(
    "should serve indexable content without JavaScript when requesting %s",
    async (page) => {
      const path = page === "home" ? "/" : `/${page}/`;
      const response = await fetch(`${origin}${path}`, { headers: { Accept: "text/html" } });
      expect(response.status).toBe(200);
      expect(response.headers.get("Vary")).toMatch(/\bAccept\b/);
      const html = await response.text();
      const body = html.split("<body>")[1] ?? "";
      const text = body
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "")
        .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/g, "")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ");
      expect(text.length).toBeGreaterThan(500);
      expect(html.match(/<h1\b/g)).toHaveLength(1);
      let previous = 0;
      for (const heading of html.matchAll(/<h([1-6])\b/g)) {
        const level = Number(heading[1]);
        expect(level).toBeLessThanOrEqual(previous + 1);
        previous = level;
      }
      const scripts = [
        ...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g),
      ];
      expect(scripts).toHaveLength(1);
      for (const script of scripts) {
        expect(JSON.parse(script[1] ?? "")).toEqual(
          expect.objectContaining({
            "@context": "https://schema.org",
            "@graph": expect.arrayContaining([
              expect.objectContaining({
                "@type": "Organization",
                contactPoint: expect.objectContaining({
                  email: "hello@stormix.co",
                  contactType: "customer support",
                }),
              }),
            ]),
          }),
        );
      }
      for (const suffix of ["", "index.md"]) {
        const markdown = await fetch(`${origin}${path}${suffix}`, {
          headers: { Accept: "text/markdown" },
        });
        expect(markdown.status).toBe(200);
        expect(markdown.headers.get("Content-Type")).toContain("text/markdown");
        expect(markdown.headers.get("Vary")).toMatch(/\bAccept\b/);
        expect((await markdown.text()).length).toBeGreaterThan(500);
      }
      const head = await fetch(`${origin}${path}`, { method: "HEAD" });
      expect(head.status).toBe(200);
      expect(await head.text()).toBe("");
      const unacceptable = await fetch(`${origin}${path}`, {
        headers: { Accept: "application/json" },
      });
      expect(unacceptable.status).toBe(406);
      for (const match of html.matchAll(/(?:src|href)="(\/[^"#]*)(?:#[^"]*)?"/g)) {
        const linked = await fetch(`${origin}${match[1]}`, { method: "HEAD" });
        expect(linked.status, match[1]).toBe(200);
      }
    },
  );

  it("should serve valid discovery files when agents request them", async () => {
    const robots = await fetch(`${origin}/robots.txt`);
    expect(robots.status).toBe(200);
    expect(robots.headers.get("Content-Type")).toContain("text/plain");
    expect(await robots.text()).toContain("Sitemap: https://transcriptsmcp.dev/sitemap.xml");
    const sitemap = await fetch(`${origin}/sitemap.xml`);
    expect(sitemap.status).toBe(200);
    expect(sitemap.headers.get("Content-Type")).toContain("xml");
    const xml = await sitemap.text();
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    expect([...xml.matchAll(/<loc>/g)]).toHaveLength(pageIds.length);
    for (const page of pageIds)
      expect(xml).toContain(
        `https://transcriptsmcp.dev/${page === "home" ? "" : `${page}/`}</loc>`,
      );
    const llms = await fetch(`${origin}/llms.txt`);
    expect(llms.status).toBe(200);
    expect(llms.headers.get("Content-Type")).toContain("text/plain");
    const guidance = await llms.text();
    expect(guidance).toMatch(/^# transcripts-mcp\s+> /);
    expect(guidance).toContain("## When to use this");
    const sections = guidance.split(/^## /m).slice(1);
    for (const section of sections) {
      for (const line of section
        .split("\n")
        .slice(1)
        .filter((entry) => entry.trim()))
        expect(line).toMatch(/^- \[[^\]]+\]\(https:\/\/[^)]+\)/);
    }
    for (const match of guidance.matchAll(/\]\(https:\/\/transcriptsmcp.dev([^)]*)\)/g))
      expect((await fetch(`${origin}${match[1]}`)).status).toBe(200);
  });

  it.each([
    "/does-not-exist",
    "/nested/missing",
    "/missing.js",
    "/developers/missing",
    "/.well-known/missing",
  ])("should return an agent-friendly 404 when requesting %s", async (path) => {
    const response = await fetch(`${origin}${path}`);
    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toContain("text/markdown");
    expect(await response.text()).toContain("llms.txt");
  });
});

import { markdownForPage } from "./lib/markdown";
import { negotiate } from "./lib/negotiate";
import { pageIds } from "./lib/page";

export default {
  async fetch(request: Request, env: { ASSETS: Pick<Env["ASSETS"], "fetch"> }): Promise<Response> {
    const url = new URL(request.url);
    const headers = new Headers({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "DENY",
    });
    if (request.method !== "GET" && request.method !== "HEAD") {
      headers.set("Allow", "GET, HEAD");
      return new Response(null, { status: 405, headers });
    }
    const page = pageIds.find((id) => {
      const base = id === "home" ? "/" : `/${id}/`;
      return [base, base.slice(0, -1) || "/", `${base}index.html`, `${base}index.md`].includes(
        url.pathname,
      );
    });
    if (page) {
      const base = page === "home" ? "/" : `/${page}/`;
      headers.set("Vary", "Accept, Accept-Encoding");
      headers.set(
        "Link",
        `<${base}index.md>; rel="alternate"; type="text/markdown", </llms.txt>; rel="describedby"`,
      );
      if (url.pathname !== base && !url.pathname.endsWith("index.md")) {
        url.pathname = base;
        headers.set("Location", url.href);
        return new Response(null, { status: 308, headers });
      }
      const format = url.pathname.endsWith("index.md")
        ? "markdown"
        : negotiate(request.headers.get("Accept"));
      if (!format) return new Response(null, { status: 406, headers });
      if (format === "markdown") {
        headers.set("Content-Type", "text/markdown; charset=utf-8");
        return new Response(request.method === "HEAD" ? null : markdownForPage(page), { headers });
      }
      const asset = await env.ASSETS.fetch(request);
      const response = new Response(asset.body, asset);
      headers.forEach((value, name) => response.headers.set(name, value));
      return response;
    }
    const asset = await env.ASSETS.fetch(request);
    if (asset.status !== 404) return asset;
    headers.set("Content-Type", "text/markdown; charset=utf-8");
    headers.set("X-Robots-Tag", "noindex");
    return new Response(
      request.method === "HEAD"
        ? null
        : "# 404 — Not found\n\nThis resource does not exist.\n\n- [Sitemap](https://transcriptsmcp.dev/sitemap.xml)\n- [Agent guidance](https://transcriptsmcp.dev/llms.txt)\n- [Developer documentation](https://transcriptsmcp.dev/developers/)\n",
      { status: 404, headers },
    );
  },
};

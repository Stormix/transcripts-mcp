import { preferredContentType } from "./negotiate";

const problems = {
  404: {
    title: "Not Found",
    detail: "The requested resource does not exist.",
    code: "not_found",
    hint: "Use /openapi.json for HTTP operations or /llms.txt for documentation. Local transcript tools are available through MCP stdio only.",
  },
  405: {
    title: "Method Not Allowed",
    detail: "This resource only supports GET and HEAD.",
    code: "method_not_allowed",
    hint: "Retry with GET to read the resource or HEAD to retrieve its headers. This website does not accept transcript uploads or MCP tool calls.",
  },
  406: {
    title: "Not Acceptable",
    detail: "The requested response format is not available for this resource.",
    code: "not_acceptable",
    hint: "Use Accept: application/json for /api/docs/{page}, or text/html or text/markdown for website pages. See /openapi.json for supported representations.",
  },
};

export function errorResponse(
  request: Request,
  status: keyof typeof problems,
  headers: Headers,
): Response {
  const problem = problems[status];
  const url = new URL(request.url);
  const preferred = preferredContentType(request.headers.get("Accept"), [
    "text/html",
    "text/markdown",
    "application/json",
    "application/problem+json",
  ]);
  const json =
    url.pathname === "/api" ||
    url.pathname.startsWith("/api/") ||
    preferred === "application/json" ||
    preferred === "application/problem+json";
  headers.set("Vary", "Accept, Accept-Encoding");
  headers.set("X-Robots-Tag", "noindex");
  headers.set("Cache-Control", "no-store");
  headers.set(
    "Content-Type",
    json ? "application/problem+json; charset=utf-8" : "text/markdown; charset=utf-8",
  );
  const body = json
    ? JSON.stringify({
        type: "about:blank",
        title: problem.title,
        status,
        detail: problem.detail,
        instance: url.pathname,
        code: problem.code,
        hint: problem.hint,
      })
    : `# ${status} — ${problem.title}\n\n${problem.detail}\n\n${problem.hint}\n\n- [Sitemap](https://transcriptsmcp.dev/sitemap.xml)\n- [Agent guidance](https://transcriptsmcp.dev/llms.txt)\n- [Developer documentation](https://transcriptsmcp.dev/developers/)\n`;
  return new Response(request.method === "HEAD" ? null : body, { status, headers });
}

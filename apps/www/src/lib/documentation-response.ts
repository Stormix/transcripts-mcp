import { errorResponse } from "./http-error";
import { markdownForPage } from "./markdown";
import { preferredContentType } from "./negotiate";
import { pageIds } from "./page";
import { seoForPage } from "./seo";

export function documentationResponse(request: Request, headers: Headers): Response {
  const url = new URL(request.url);
  const page = pageIds.find((id) => url.pathname === `/api/docs/${id}`);
  if (!page) return errorResponse(request, 404, headers);
  headers.set("Vary", "Accept, Accept-Encoding");
  headers.set("Link", '</openapi.json>; rel="service-desc", </developers/>; rel="service-doc"');
  if (!preferredContentType(request.headers.get("Accept"), ["application/json"])) {
    return errorResponse(request, 406, headers);
  }
  const seo = seoForPage(page);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(
    request.method === "HEAD"
      ? null
      : JSON.stringify({
          page,
          title: seo.title,
          description: seo.description,
          url: seo.canonical,
          markdown: markdownForPage(page),
        }),
    { headers },
  );
}

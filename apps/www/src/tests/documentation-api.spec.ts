import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import openapi from "../../public/openapi.json";
import manifest from "../../public/server.json";
import { markdownForPage } from "../lib/markdown";
import { pageIds } from "../lib/page";
import { seoForPage } from "../lib/seo";
import worker from "../worker";

const missingAssets = { ASSETS: { fetch: async () => new Response(null, { status: 404 }) } };

describe("documentation API", () => {
  it.each(pageIds)("should return the documented schema when reading %s", async (page) => {
    const response = await worker.fetch(
      new Request(`https://transcriptsmcp.dev/api/docs/${page}`),
      missingAssets,
    );
    const seo = seoForPage(page);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(response.headers.get("Vary")).toContain("Accept");
    expect(response.headers.get("Link")).toContain("/openapi.json");
    expect(await response.json()).toEqual({
      page,
      title: seo.title,
      description: seo.description,
      url: seo.canonical,
      markdown: markdownForPage(page),
    });
    expect(openapi.components.schemas.Documentation.required).toEqual([
      "page",
      "title",
      "description",
      "url",
      "markdown",
    ]);
    const head = await worker.fetch(
      new Request(`https://transcriptsmcp.dev/api/docs/${page}`, { method: "HEAD" }),
      missingAssets,
    );
    expect(head.status).toBe(200);
    expect(head.headers.get("Content-Type")).toBe(response.headers.get("Content-Type"));
    expect(await head.text()).toBe("");
  });

  it.each([
    ["/api", "GET", "*/*", 404, "not_found"],
    ["/api/missing", "GET", "*/*", 404, "not_found"],
    ["/api/docs/nope", "GET", "application/json", 404, "not_found"],
    ["/api/docs/home/", "GET", "application/json", 404, "not_found"],
    ["/api/docs/home", "POST", "application/json", 405, "method_not_allowed"],
    ["/api/docs/home", "GET", "text/html", 406, "not_acceptable"],
    ["/api/docs/home", "GET", "application/json;q=0, */*;q=1", 406, "not_acceptable"],
    ["/nope", "GET", "application/json", 404, "not_found"],
    ["/nope", "GET", "application/problem+json", 404, "not_found"],
    ["/", "GET", "application/json", 406, "not_acceptable"],
    ["/", "POST", "application/json", 405, "method_not_allowed"],
  ])(
    "should provide problem details when %s receives %s with %s",
    async (path, method, accept, status, code) => {
      const response = await worker.fetch(
        new Request(`https://transcriptsmcp.dev${path}?token=must-not-be-reflected`, {
          method,
          headers: { Accept: accept },
        }),
        missingAssets,
      );
      expect(response.status).toBe(status);
      expect(response.headers.get("Content-Type")).toContain("application/problem+json");
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(response.headers.get("Vary")).toContain("Accept");
      expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
      expect(await response.json()).toEqual({
        type: "about:blank",
        title: expect.any(String),
        status,
        detail: expect.any(String),
        instance: path,
        code,
        hint: expect.any(String),
      });
      if (status === 405) expect(response.headers.get("Allow")).toBe("GET, HEAD");
    },
  );

  it.each(["application/json", "application/*", "*/*", "text/html;q=1, application/json;q=0.5"])(
    "should serve JSON when it is acceptable through %s",
    async (accept) => {
      expect(
        (
          await worker.fetch(
            new Request("https://transcriptsmcp.dev/api/docs/home", {
              headers: { Accept: accept },
            }),
            missingAssets,
          )
        ).status,
      ).toBe(200);
    },
  );

  it("should omit problem bodies when the request method is HEAD", async () => {
    for (const path of ["/api/nope", "/api/docs/home"]) {
      const response = await worker.fetch(
        new Request(`https://transcriptsmcp.dev${path}`, {
          method: "HEAD",
          headers: { Accept: "text/html" },
        }),
        missingAssets,
      );
      expect(response.status).toBe(path === "/api/nope" ? 404 : 406);
      expect(response.headers.get("Content-Type")).toContain("application/problem+json");
      expect(await response.text()).toBe("");
    }
  });

  it("should preserve Markdown recovery pages when JSON is excluded", async () => {
    const response = await worker.fetch(
      new Request("https://transcriptsmcp.dev/nope", {
        headers: { Accept: "application/json;q=0, text/markdown;q=1" },
      }),
      missingAssets,
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toContain("text/markdown");
    expect(await response.text()).toContain("sitemap.xml");
  });
});

describe("published protocol files", () => {
  it("should describe the implemented API with unique operations and typed parameters", () => {
    expect(openapi.openapi).toBe("3.1.1");
    expect(openapi.servers).toEqual([
      { url: "https://transcriptsmcp.dev", description: expect.any(String) },
    ]);
    expect(openapi.security).toEqual([]);
    const operations = Object.values(openapi.paths).flatMap((path) => Object.values(path));
    expect(new Set(operations.map((operation) => operation.operationId)).size).toBe(
      operations.length,
    );
    for (const operation of operations) {
      expect(operation.description.length).toBeGreaterThan(30);
      expect(operation.parameters).toEqual([
        {
          name: "page",
          in: "path",
          required: true,
          description: expect.any(String),
          schema: { type: "string", enum: [...pageIds] },
          example: "developers",
        },
      ]);
      expect(operation.responses[200].description).toBeTruthy();
    }
    expect(
      openapi.paths["/api/docs/{page}"].get.responses[200].content["application/json"].schema.$ref,
    ).toBe("#/components/schemas/Documentation");
    expect(openapi.components.schemas.Documentation.properties.page.enum).toEqual([...pageIds]);
    expect(openapi.components.schemas.Problem.required).toEqual([
      "type",
      "title",
      "status",
      "detail",
      "instance",
      "code",
      "hint",
    ]);
  });

  it("should describe the real npm package and stdio transport when reading the MCP manifest", () => {
    expect(manifest.$schema).toBe(
      "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
    );
    expect(manifest.name).toBe("io.github.Stormix/transcripts-mcp");
    expect(manifest.packages).toEqual([
      {
        registryType: "npm",
        registryBaseUrl: "https://registry.npmjs.org",
        identifier: "transcripts-mcp",
        version: manifest.version,
        transport: { type: "stdio" },
      },
    ]);
    const packageJson = readFileSync(
      new URL("../../../../packages/cli/package.json", import.meta.url),
      "utf8",
    );
    expect(JSON.parse(packageJson)).toEqual(
      expect.objectContaining({
        name: "transcripts-mcp",
        version: manifest.version,
        bin: { "transcripts-mcp": "./dist/cli.js" },
      }),
    );
    expect(manifest).not.toHaveProperty("remotes");
  });
});

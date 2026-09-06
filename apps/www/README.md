# Website

Vite prerenders the same React components that the browser hydrates. Cloudflare
serves those static HTML pages through a Worker that negotiates Markdown and
returns Markdown recovery links with HTTP 404 for missing assets.

## Verification

From the repository root, run `pnpm lint:fix`, `pnpm format`, `pnpm check-types`,
and `pnpm test`. Build with `pnpm --filter @transcripts-mcp/www run build`.

To exercise the production assets and Worker locally, run this from `apps/www`:

```sh
pnpm exec wrangler dev --config dist/transcripts_mcp_www/wrangler.json --local --port 4173
```

In another terminal, set `WWW_TEST_URL=http://127.0.0.1:4173` and run
`pnpm test` from the repository root. The HTTP suite checks all six pages, their
Markdown variants, linked assets, discovery files, headings, JSON-LD, and missing
paths. It is skipped when `WWW_TEST_URL` is unset. Set that variable to the public
origin after deployment to repeat the endpoint checks against production.

Run `pnpm --filter @transcripts-mcp/www exec wrangler types src/worker-configuration.d.ts`
after changing bindings. The generated declaration includes the Workers runtime
types and is not handwritten.

## Deployment follow-up

Deploy with `pnpm deploy:www`, then rerun the HTTP suite against
`https://transcriptsmcp.dev` and request a new readiness audit. Search ranking and
indexing require Search Console/Bing Webmaster Tools access and time to recrawl.

The September 6, 2026 verification found Cloudflare returning HTTP 403, error
1010 (`browser_signature_banned`), to direct audit requests for the live site.
Review the matching Cloudflare security events and browser integrity settings so
intended crawlers can reach public content. This is outside the repository's
Worker configuration.

The official npm registry already publishes `transcripts-mcp` version 0.0.3 with
a `transcripts-mcp` executable. The developer page links to it. No hosted API keys
or hosted sandbox exist; the portal documents local stdio and fixture testing.
Organization schema uses the existing public email. A postal address is omitted
at the owner's request.

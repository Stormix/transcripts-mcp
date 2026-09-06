import { createRootRoute, Link } from "@tanstack/react-router";

import { App } from "../App";
import { DocPage } from "../components/doc-page";
import { Document } from "../document";

export const Route = createRootRoute({
  component: App,
  shellComponent: Document,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap",
      },
    ],
  }),
  notFoundComponent: () => (
    <DocPage title="Page not found" lede="The page you requested does not exist.">
      <Link to="/" className="text-paper underline">
        Return home
      </Link>
    </DocPage>
  ),
});

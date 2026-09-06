import { Outlet, useLocation } from "@tanstack/react-router";
import { ReactLenis } from "lenis/react";

import { SiteFooter } from "./components/site-footer";
import { SiteHeader } from "./components/site-header";
import { pageFromPath } from "./lib/page";

export function App() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const page = pageFromPath(pathname);

  return (
    <ReactLenis root options={{ lerp: 0.08, duration: 1.15, smoothWheel: true }}>
      <div id="top" className="min-h-full bg-ink font-body text-paper">
        <SiteHeader page={page} />
        <main>
          <Outlet />
        </main>
        <SiteFooter page={page} />
      </div>
    </ReactLenis>
  );
}

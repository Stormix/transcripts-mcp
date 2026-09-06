import type { ReactNode } from "react";

import { HeadContent, Scripts } from "@tanstack/react-router";

import "./index.css";

export function Document({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark scheme-only-dark">
      <head>
        <HeadContent />
      </head>
      <body>
        <div id="root">{children}</div>
        <Scripts />
      </body>
    </html>
  );
}

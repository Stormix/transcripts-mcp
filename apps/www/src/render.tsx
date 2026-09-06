import type { PageId } from "./lib/page";

import { renderToString } from "react-dom/server";

import { App } from "./App";

export function render(page: PageId) {
  return renderToString(<App page={page} />);
}

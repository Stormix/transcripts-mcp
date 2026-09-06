import { StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";

import { App } from "./App";
import { pageFromPath } from "./lib/page";

import "./index.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element #root was not found");
}

hydrateRoot(
  root,
  <StrictMode>
    <App page={pageFromPath(window.location.pathname)} />
  </StrictMode>,
);

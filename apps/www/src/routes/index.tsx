import { createFileRoute } from "@tanstack/react-router";

import { Home } from "../components/home";
import { headForPage } from "../lib/head";

export const Route = createFileRoute("/")({
  head: () => headForPage("home"),
  component: Home,
});

import { createFileRoute } from "@tanstack/react-router";

import { FaqPage } from "../components/faq-page";
import { headForPage } from "../lib/head";

export const Route = createFileRoute("/faq")({
  head: () => headForPage("faq"),
  component: FaqPage,
});

import { createFileRoute } from "@tanstack/react-router";

import { PrivacyPage } from "../components/privacy-page";
import { headForPage } from "../lib/head";

export const Route = createFileRoute("/privacy")({
  head: () => headForPage("privacy"),
  component: PrivacyPage,
});

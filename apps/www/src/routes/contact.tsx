import { createFileRoute } from "@tanstack/react-router";

import { InfoPage } from "../components/info-page";
import { headForPage } from "../lib/head";

export const Route = createFileRoute("/contact")({
  head: () => headForPage("contact"),
  component: () => <InfoPage page="contact" />,
});

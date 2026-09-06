import { createFileRoute } from "@tanstack/react-router";

import { InfoPage } from "../components/info-page";
import { headForPage } from "../lib/head";

export const Route = createFileRoute("/about")({
  head: () => headForPage("about"),
  component: () => <InfoPage page="about" />,
});

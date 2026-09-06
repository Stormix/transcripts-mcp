import { useLenis } from "lenis/react";
import { useEffect } from "react";

import { Hero } from "./hero";
import { HowItWorks } from "./how-it-works";
import { Install } from "./install";
import { SearchTiers } from "./search-tiers";
import { ToolsTable } from "./tools-table";

export function Home() {
  const lenis = useLenis();

  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) {
      return;
    }

    const target = document.getElementById(id);
    if (!target) {
      return;
    }

    if (lenis) {
      lenis.scrollTo(target, { offset: -16 });
      return;
    }

    target.scrollIntoView();
  }, [lenis]);

  return (
    <>
      <Hero />
      <HowItWorks />
      <Install />
      <SearchTiers />
      <ToolsTable />
    </>
  );
}

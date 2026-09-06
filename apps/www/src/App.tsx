import { ReactLenis, useLenis } from "lenis/react";
import { useEffect } from "react";

import { FaqPage } from "./components/faq-page";
import { Hero } from "./components/hero";
import { HowItWorks } from "./components/how-it-works";
import { InfoPage } from "./components/info-page";
import { Install } from "./components/install";
import { PrivacyPage } from "./components/privacy-page";
import { SearchTiers } from "./components/search-tiers";
import { SiteFooter } from "./components/site-footer";
import { SiteHeader } from "./components/site-header";
import { ToolsTable } from "./components/tools-table";
import { type PageId } from "./lib/page";
import { seoForPage } from "./lib/seo";

import "lenis/dist/lenis.css";

export function App({ page }: { page: PageId }) {
  const seo = seoForPage(page);

  useEffect(() => {
    document.title = seo.title;
  }, [seo.title]);

  return (
    <ReactLenis root options={{ lerp: 0.08, duration: 1.15, smoothWheel: true }}>
      <div id="top" className="min-h-full bg-ink font-body text-paper">
        <SiteHeader page={page} />
        <main>
          <PageBody page={page} />
        </main>
        <SiteFooter page={page} />
      </div>
    </ReactLenis>
  );
}

function PageBody({ page }: { page: PageId }) {
  switch (page) {
    case "home":
      return <Home />;
    case "privacy":
      return <PrivacyPage />;
    case "about":
    case "contact":
    case "developers":
      return <InfoPage page={page} />;
    case "faq":
      return <FaqPage />;
    default: {
      const exhaustive: never = page;
      return exhaustive;
    }
  }
}

function Home() {
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

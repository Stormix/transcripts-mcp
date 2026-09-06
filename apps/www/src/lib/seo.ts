import type { PageId } from "./page";

import { infoPages } from "./info-pages";
import { privacyEmail } from "./site";
import { faqItems, faqPath, howItWorks, privacyPath, repoUrl } from "./site";

export const siteOrigin = "https://transcriptsmcp.dev";
export const siteUrl = `${siteOrigin}/`;
export const siteName = "transcripts-mcp";
export const siteTitle = "transcripts-mcp: search Cursor, Claude Code, Codex sessions";
export const siteDescription =
  "Search Cursor, Claude Code, and Codex session transcripts from any MCP client. Local files only: list sessions, open one, grep, or rank with FTS5.";
export const ogImagePath = "/og.png";
export const ogImageUrl = `${siteOrigin}${ogImagePath}`;
export const ogImageAlt =
  "transcripts-mcp: search Cursor, Claude Code, and Codex session transcripts from any MCP client";
export const ogImageWidth = "1200";
export const ogImageHeight = "630";
export const themeColor = "#171615";
export const logoUrl = `${siteOrigin}/logo.png`;

const organizationId = `${siteUrl}#organization`;
const websiteId = `${siteUrl}#website`;
const webpageId = `${siteUrl}#webpage`;
const appId = `${siteUrl}#app`;
const privacyUrl = `${siteOrigin}${privacyPath}`;
const faqUrl = `${siteOrigin}${faqPath}`;

const privacyTitle = "transcripts-mcp: privacy policy";
const privacyDescription =
  "What transcriptsmcp.dev collects, why, how long it is kept, and how to exercise your rights.";
const faqTitle = "transcripts-mcp: FAQ";
const faqDescription =
  "Install, grep vs index, semantic search, and which clients transcripts-mcp supports.";

const organization = {
  "@type": "Organization",
  "@id": organizationId,
  name: siteName,
  url: siteUrl,
  logo: {
    "@type": "ImageObject",
    url: logoUrl,
  },
  sameAs: [repoUrl],
  contactPoint: {
    "@type": "ContactPoint",
    email: privacyEmail,
    contactType: "customer support",
    url: `${siteOrigin}/contact/`,
  },
};

const website = {
  "@type": "WebSite",
  "@id": websiteId,
  url: siteUrl,
  name: siteName,
  description: siteDescription,
  inLanguage: "en",
  publisher: { "@id": organizationId },
};

export interface PageSeo {
  title: string;
  description: string;
  canonical: string;
  jsonLd: string;
}

export function seoForPage(page: PageId): PageSeo {
  switch (page) {
    case "about":
    case "contact":
    case "developers": {
      const copy = infoPages[page];
      const canonical = `${siteOrigin}/${page}/`;
      return {
        title: copy.title,
        description: copy.lede,
        canonical,
        jsonLd: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            organization,
            website,
            {
              "@type":
                page === "about" ? "AboutPage" : page === "contact" ? "ContactPage" : "WebPage",
              "@id": `${canonical}#webpage`,
              url: canonical,
              name: copy.title,
              description: copy.lede,
              isPartOf: { "@id": websiteId },
            },
          ],
        }),
      };
    }
    case "home":
      return homeSeo;
    case "privacy":
      return privacySeo;
    case "faq":
      return faqSeo;
    default: {
      const exhaustive: never = page;
      return exhaustive;
    }
  }
}

const homeSeo: PageSeo = {
  title: siteTitle,
  description: siteDescription,
  canonical: siteUrl,
  jsonLd: JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      organization,
      website,
      {
        "@type": "WebPage",
        "@id": webpageId,
        url: siteUrl,
        name: siteTitle,
        description: siteDescription,
        inLanguage: "en",
        isPartOf: { "@id": websiteId },
        about: { "@id": appId },
        primaryImageOfPage: {
          "@type": "ImageObject",
          url: ogImageUrl,
        },
      },
      {
        "@type": "SoftwareApplication",
        "@id": appId,
        name: siteName,
        url: siteUrl,
        description: siteDescription,
        downloadUrl: "https://www.npmjs.com/package/transcripts-mcp",
        sameAs: [repoUrl, "https://www.npmjs.com/package/transcripts-mcp"],
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Windows, macOS, Linux",
        isAccessibleForFree: true,
        license: `${repoUrl}/blob/main/LICENSE`,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        author: {
          "@type": "Person",
          name: "Stormix",
          url: "https://github.com/Stormix",
        },
        publisher: { "@id": organizationId },
      },
      {
        "@type": "SoftwareSourceCode",
        name: siteName,
        codeRepository: repoUrl,
        programmingLanguage: {
          "@type": "ComputerLanguage",
          name: "TypeScript",
        },
        runtimePlatform: "Bun",
        license: "https://opensource.org/licenses/MIT",
      },
      {
        "@type": "HowTo",
        name: "Search agent session transcripts with transcripts-mcp",
        description: siteDescription,
        step: howItWorks.map((step, index) => ({
          "@type": "HowToStep",
          position: index + 1,
          name: step.title,
          text: step.body,
        })),
      },
    ],
  }),
};

const privacySeo: PageSeo = {
  title: privacyTitle,
  description: privacyDescription,
  canonical: privacyUrl,
  jsonLd: JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      organization,
      website,
      {
        "@type": "WebPage",
        "@id": `${privacyUrl}#webpage`,
        url: privacyUrl,
        name: privacyTitle,
        description: privacyDescription,
        inLanguage: "en",
        isPartOf: { "@id": websiteId },
        breadcrumb: {
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: siteName,
              item: siteUrl,
            },
            {
              "@type": "ListItem",
              position: 2,
              name: "Privacy policy",
              item: privacyUrl,
            },
          ],
        },
      },
    ],
  }),
};

const faqSeo: PageSeo = {
  title: faqTitle,
  description: faqDescription,
  canonical: faqUrl,
  jsonLd: JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      organization,
      website,
      {
        "@type": "FAQPage",
        "@id": `${faqUrl}#webpage`,
        url: faqUrl,
        name: faqTitle,
        description: faqDescription,
        inLanguage: "en",
        isPartOf: { "@id": websiteId },
        breadcrumb: {
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: siteName,
              item: siteUrl,
            },
            {
              "@type": "ListItem",
              position: 2,
              name: "FAQ",
              item: faqUrl,
            },
          ],
        },
        mainEntity: faqItems.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      },
    ],
  }),
};

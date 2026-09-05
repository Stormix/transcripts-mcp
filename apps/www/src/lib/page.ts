export const pageIds = ["home", "privacy", "faq"] as const;

export type PageId = (typeof pageIds)[number];

export function pageFromPath(pathname: string): PageId {
  const path = pathname.replace(/\/+$/, "") || "/";

  switch (path) {
    case "/privacy":
      return "privacy";
    case "/faq":
      return "faq";
    case "/":
      return "home";
    default:
      return "home";
  }
}

export function pageFromHtmlFilename(filename: string): PageId {
  const normalized = filename.replaceAll("\\", "/");

  if (normalized.endsWith("/privacy/index.html")) {
    return "privacy";
  }

  if (normalized.endsWith("/faq/index.html")) {
    return "faq";
  }

  return "home";
}

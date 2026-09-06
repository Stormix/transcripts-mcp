export const pageIds = ["home", "privacy", "faq", "about", "contact", "developers"] as const;

export type PageId = (typeof pageIds)[number];

export function pageFromPath(pathname: string): PageId {
  const path = pathname.replace(/\/+$/, "") || "/";

  switch (path) {
    case "/about":
      return "about";
    case "/contact":
      return "contact";
    case "/developers":
      return "developers";
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

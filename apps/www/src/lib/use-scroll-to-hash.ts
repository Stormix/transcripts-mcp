import type { MouseEvent } from "react";

import { useLenis } from "lenis/react";

export function useScrollToHash() {
  const lenis = useLenis();

  return function scrollToHash(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (!href.startsWith("#")) {
      return;
    }

    event.preventDefault();
    const id = href.slice(1);
    const target = document.getElementById(id);

    if (!target) {
      return;
    }

    if (lenis) {
      lenis.scrollTo(target, { offset: -16 });
      return;
    }

    target.scrollIntoView({ behavior: "smooth" });
  };
}

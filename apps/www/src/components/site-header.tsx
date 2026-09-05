import type { PageId } from "@/lib/page";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { navLinks, repoUrl } from "@/lib/site";
import { useScrollToHash } from "@/lib/use-scroll-to-hash";
import { Github, Menu } from "lucide-react";
import { useState } from "react";

import { Container } from "./container";
import { LogoMark } from "./logo-mark";

export function SiteHeader({ page }: { page: PageId }) {
  const scrollToHash = useScrollToHash();
  const [open, setOpen] = useState(false);
  const home = page === "home";

  return (
    <header className="bg-ink">
      <Container className="flex items-center justify-between py-[22px]">
        <a
          href={home ? "#top" : "/"}
          className="flex items-center gap-[11px]"
          onClick={home ? (event) => scrollToHash(event, "#top") : undefined}
        >
          <LogoMark />
          <span className="font-mono text-[14.5px] font-medium text-paper">transcripts-mcp</span>
        </a>

        <nav className="hidden items-center gap-[30px] lg:flex">
          {navLinks.map((link) => {
            const href = home ? link.href : `/${link.href}`;
            return (
              <a
                key={link.href}
                href={href}
                onClick={home ? (event) => scrollToHash(event, link.href) : undefined}
                className="font-body text-[13.5px] text-soft transition-colors hover:text-paper"
              >
                {link.label}
              </a>
            );
          })}
          <a
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-[7px] rounded-[7px] px-[13px] py-2 text-paper transition-colors hover:bg-ink-raised"
          >
            <Github className="size-[14px]" />
            <span className="font-body text-[13.5px] font-medium">GitHub</span>
          </a>
        </nav>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            className="inline-flex size-9 items-center justify-center rounded-md text-paper lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </SheetTrigger>
          <SheetContent side="right" className="border-line bg-ink text-paper">
            <SheetHeader>
              <SheetTitle className="font-mono text-paper">transcripts-mcp</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-5 px-4">
              {navLinks.map((link) => {
                const href = home ? link.href : `/${link.href}`;
                return (
                  <a
                    key={link.href}
                    href={href}
                    className="font-body text-base text-soft hover:text-paper"
                    onClick={(event) => {
                      if (home) {
                        scrollToHash(event, link.href);
                      }
                      setOpen(false);
                    }}
                  >
                    {link.label}
                  </a>
                );
              })}
              <a
                href={repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-body text-base text-paper"
              >
                GitHub
              </a>
            </div>
          </SheetContent>
        </Sheet>
      </Container>
    </header>
  );
}

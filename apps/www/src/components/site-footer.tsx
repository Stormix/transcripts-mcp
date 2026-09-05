import type { PageId } from "@/lib/page";
import type { ReactNode } from "react";

import { footerPages, footerProject, providers } from "@/lib/site";

import { Container } from "./container";
import { LogoMark } from "./logo-mark";
import { ProviderIcon } from "./provider-icon";

export function SiteFooter({ page }: { page: PageId }) {
  return (
    <footer className="bg-ink-sunken">
      <Container className="flex flex-col gap-11 pt-[52px] pb-10">
        <div className="flex flex-col gap-12 lg:flex-row lg:gap-20">
          <div className="flex max-w-[320px] flex-col gap-3.5">
            <div className="flex items-center gap-[11px]">
              <LogoMark compact />
              <span className="font-mono text-sm font-medium text-paper">transcripts-mcp</span>
            </div>
            <p className="max-w-[280px] font-body text-[13.5px] leading-relaxed text-faint">
              Search Cursor, Claude Code, and Codex sessions from any MCP client.
            </p>
          </div>
          <div className="flex flex-1 flex-col gap-10 sm:flex-row sm:justify-end sm:gap-16">
            <FooterCol>
              {footerPages.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  aria-current={item.href === `/${page}/` ? "page" : undefined}
                  className="font-body text-[13.5px] text-faint transition-colors hover:text-paper"
                >
                  {item.label}
                </a>
              ))}
            </FooterCol>
            <FooterCol>
              {footerProject.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-body text-[13.5px] text-faint transition-colors hover:text-paper"
                >
                  {item.label}
                </a>
              ))}
            </FooterCol>
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-line-soft pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-body text-[12.5px] text-faint">MIT licensed.</p>
          <div className="flex items-center gap-4">
            {providers.map((provider) => (
              <span key={provider.id} className="flex items-center gap-1.5">
                <ProviderIcon id={provider.id} className="size-3.5 text-faint" />
                <span className="font-mono text-xs text-faint">{provider.id}</span>
              </span>
            ))}
          </div>
        </div>
      </Container>
    </footer>
  );
}

function FooterCol({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-[13px]">{children}</div>;
}

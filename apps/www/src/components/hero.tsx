import { cursorInstallUrl } from "@/lib/install";
import { launchCommand } from "@/lib/site";
import { useScrollToHash } from "@/lib/use-scroll-to-hash";
import { ArrowRight } from "lucide-react";

import { Container } from "./container";
import { CopyButton } from "./copy-button";
import { ProviderMarks } from "./provider-icon";
import { SessionPreview } from "./session-preview";

export function Hero() {
  const scrollToHash = useScrollToHash();

  return (
    <section className="bg-ink">
      <Container className="flex flex-col gap-14 pt-24 pb-[84px] lg:flex-row">
        <div className="flex w-full max-w-[600px] flex-col gap-[26px]">
          <div className="flex flex-col gap-5">
            <ProviderMarks className="text-paper" iconClassName="size-[18px]" />
            <h1 className="font-display text-[44px] leading-[1.05] font-semibold tracking-[-0.03em] text-balance text-paper sm:text-[62px]">
              Search your Cursor, Claude Code, and Codex sessions.
            </h1>
          </div>
          <p className="max-w-[520px] font-body text-[17px] leading-relaxed text-soft">
            They already keep every chat as a file on disk. This MCP server reads those files, so
            the session you are in can list past sessions, open one, or search across them.
          </p>
          <div className="flex flex-col items-start gap-3 pt-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="flex items-center gap-3.5 rounded-[9px] bg-ink-raised py-[13px] pr-4 pl-4">
              <span className="font-mono text-[13.5px] text-coral">$</span>
              <span className="font-mono text-[13.5px] text-paper">{launchCommand}</span>
              <CopyButton value={launchCommand} iconClassName="size-[15px]" />
            </div>
            <a
              href={cursorInstallUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-[7px] rounded-[9px] px-4 py-[13px] font-body text-sm font-medium text-paper"
            >
              Add to Cursor
              <ArrowRight className="size-[15px]" />
            </a>
            <a
              href="#configure"
              onClick={(event) => scrollToHash(event, "#configure")}
              className="flex items-center gap-[7px] px-4 py-[13px] font-body text-sm font-medium text-soft hover:text-paper"
            >
              Other clients
            </a>
          </div>
        </div>
        <SessionPreview />
      </Container>
    </section>
  );
}

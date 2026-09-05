import { cursorInstallUrl } from "@/lib/install";
import { launchCommand } from "@/lib/site";
import { useScrollToHash } from "@/lib/use-scroll-to-hash";
import { ArrowDown, ArrowUpRight } from "lucide-react";

import { Container } from "./container";
import { CopyButton } from "./copy-button";
import { ProviderMarks } from "./provider-icon";
import { SessionPreview } from "./session-preview";

export function Hero() {
  const scrollToHash = useScrollToHash();

  return (
    <section className="bg-ink">
      <Container className="pt-12 pb-16 sm:pt-20 lg:pb-24">
        <h1 className="max-w-[1200px] font-display text-[clamp(3.25rem,7.3vw,6rem)] leading-[0.98] font-semibold tracking-[-0.04em] text-balance">
          Search your <span className="text-coral">Cursor, Claude Code, and Codex</span> sessions.
        </h1>
        <div className="mt-12 grid gap-12 border-t border-line pt-8 lg:mt-16 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div className="flex flex-col items-start gap-7">
            <p className="max-w-[38ch] text-lg leading-relaxed text-soft">
              Find the fix, decision, or conversation from a previous session. transcripts-mcp lets
              your agent search across all three tools, right from your current chat.
            </p>
            <div className="flex flex-wrap items-center gap-5">
              <a
                href={cursorInstallUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="install-link inline-flex items-center gap-6 rounded-md bg-coral px-5 py-4 font-semibold text-ink transition-colors hover:bg-paper"
              >
                Add to Cursor <ArrowUpRight className="size-5" />
              </a>
              <a
                href="#configure"
                onClick={(event) => scrollToHash(event, "#configure")}
                className="configure-link inline-flex items-center gap-2 py-3 text-sm text-paper underline-offset-4 hover:underline"
              >
                Other clients <ArrowDown className="size-4" />
              </a>
            </div>
            <div className="flex max-w-full items-center gap-3 font-mono text-sm">
              <span className="text-soft" aria-hidden="true">
                $
              </span>
              <code>{launchCommand}</code>
              <CopyButton value={launchCommand} />
            </div>
            <div className="flex items-center gap-4 pt-3 text-sm text-soft">
              <ProviderMarks iconClassName="size-5" />
              <span>Three transcript sources. One search.</span>
            </div>
          </div>
          <SessionPreview />
        </div>
      </Container>
    </section>
  );
}

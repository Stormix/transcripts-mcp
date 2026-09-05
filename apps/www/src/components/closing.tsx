import { docsUrl, repoUrl } from "@/lib/site";
import { BookOpen, Github } from "lucide-react";

import { Container } from "./container";

export function Closing() {
  return (
    <section className="bg-ink">
      <Container className="flex flex-col items-center py-[110px] text-center">
        <h2 className="max-w-[760px] font-display text-[40px] leading-[1.1] font-semibold tracking-[-0.03em] text-paper sm:text-[56px]">
          Add it to a client and search what you already did.
        </h2>
        <p className="mt-6 max-w-[560px] font-body text-[16.5px] leading-relaxed text-soft">
          Paste the config, restart, then grep. Run build_index when you want ranked results.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-[9px] bg-coral px-5 py-3.5 font-body text-[14.5px] font-semibold text-ink"
          >
            <Github className="size-4" />
            View on GitHub
          </a>
          <a
            href={docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-[9px] px-5 py-3.5 font-body text-[14.5px] font-medium text-paper"
          >
            <BookOpen className="size-4" />
            Read the docs
          </a>
        </div>
      </Container>
    </section>
  );
}

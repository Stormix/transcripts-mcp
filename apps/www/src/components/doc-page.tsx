import type { ReactNode } from "react";

import { Container } from "./container";

export function DocPage({
  title,
  lede,
  updated,
  children,
}: {
  title: string;
  lede: string;
  updated?: string;
  children: ReactNode;
}) {
  return (
    <article className="bg-ink">
      <Container className="py-24 lg:py-[100px]">
        <div className="max-w-[680px]">
          <h1 className="font-display text-[42px] leading-[1.1] font-semibold tracking-[-0.03em] text-paper sm:text-[52px]">
            {title}
          </h1>
          {updated ? (
            <p className="mt-4 font-mono text-[12.5px] text-faint">Updated {updated}</p>
          ) : null}
          <p className="mt-6 font-body text-[17px] leading-relaxed text-soft">{lede}</p>
          <div className="mt-14 flex flex-col">{children}</div>
        </div>
      </Container>
    </article>
  );
}

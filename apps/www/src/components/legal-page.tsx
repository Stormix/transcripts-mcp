import type { ReactNode } from "react";

import { useScrollToHash } from "@/lib/use-scroll-to-hash";

import { Container } from "./container";

export interface LegalSection {
  id: string;
  title: string;
  content: ReactNode;
}

const bodyText = "font-body text-[15px] leading-[1.75] text-pretty text-soft";

export function LegalParagraph({ children }: { children: ReactNode }) {
  return <p className={`${bodyText} max-w-[68ch]`}>{children}</p>;
}

export function LegalList({ children }: { children: ReactNode }) {
  return (
    <ul
      className={`${bodyText} max-w-[68ch] flex list-disc flex-col gap-2.5 pl-5 marker:text-faint`}
    >
      {children}
    </ul>
  );
}

export function LegalLink({ href, children }: { href: string; children?: ReactNode }) {
  const external = href.startsWith("http");

  return (
    <a
      href={href}
      className="text-paper underline decoration-line underline-offset-4 transition-colors hover:decoration-paper"
      rel={external ? "noopener noreferrer" : undefined}
      target={external ? "_blank" : undefined}
    >
      {children ?? href.replace(/^mailto:/, "")}
    </a>
  );
}

export function LegalPage({
  title,
  summary,
  updatedIso,
  sections,
}: {
  title: string;
  summary: string;
  updatedIso: string;
  sections: LegalSection[];
}) {
  const scrollToHash = useScrollToHash();
  const updated = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${updatedIso}T00:00:00Z`));

  return (
    <article className="bg-ink">
      <Container className="py-24 lg:py-[100px]">
        <header className="max-w-[40rem]">
          <h1 className="font-display text-[42px] leading-[1.1] font-semibold tracking-[-0.03em] text-balance text-paper sm:text-[52px]">
            {title}
          </h1>
          <p className="mt-4 font-mono text-[12.5px] text-faint">
            Updated <time dateTime={updatedIso}>{updated}</time>
          </p>
          <p className="mt-8 max-w-[36rem] font-body text-[18px] leading-[1.65] text-pretty text-soft sm:text-[20px]">
            {summary}
          </p>
        </header>

        <div className="mt-16 grid gap-12 border-t border-line-soft pt-12 lg:mt-20 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-20 lg:pt-16">
          <nav
            aria-label="On this page"
            className="hidden lg:sticky lg:top-28 lg:block lg:self-start"
          >
            <h2 className="font-body text-sm font-medium text-faint">On this page</h2>
            <ol className="mt-5 flex list-none flex-col gap-3">
              {sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    onClick={(event) => scrollToHash(event, `#${section.id}`)}
                    className="font-body text-[15px] leading-[1.45] text-faint transition-colors hover:text-paper"
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="flex flex-col gap-12">
            {sections.map((section) => (
              <section
                key={section.id}
                id={section.id}
                className="flex scroll-mt-28 flex-col gap-4"
              >
                <h2 className="font-display text-xl font-semibold tracking-tight text-balance text-paper sm:text-[22px]">
                  {section.title}
                </h2>
                {section.content}
              </section>
            ))}
          </div>
        </div>
      </Container>
    </article>
  );
}

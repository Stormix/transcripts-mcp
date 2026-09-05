import { searchTiers } from "@/lib/site";

import { Container } from "./container";

export function SearchTiers() {
  return (
    <section id="search" className="bg-ink">
      <Container className="py-16 lg:py-24">
        <div className="mb-10 grid gap-5 lg:grid-cols-2 lg:gap-20">
          <h2 className="font-display text-4xl leading-[1.1] font-semibold tracking-[-0.03em] sm:text-5xl">
            Start with a search.
          </h2>
          <p className="max-w-[48ch] text-base leading-relaxed text-soft">
            Grep works as soon as you connect. Build an index when you need ranked results or search
            by meaning.
          </p>
        </div>
        <dl>
          {searchTiers.map((tier) => (
            <div
              key={tier.index}
              className="grid gap-3 border-t border-line py-7 md:grid-cols-[1fr_2fr] md:gap-12"
            >
              <dt className="font-display text-2xl font-medium">{tier.name}</dt>
              <dd className="max-w-[65ch] text-base leading-relaxed text-soft">{tier.desc}</dd>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  );
}

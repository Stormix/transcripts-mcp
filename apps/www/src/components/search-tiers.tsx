import { Badge } from "@/components/ui/badge";
import { searchTiers } from "@/lib/site";

import { Container } from "./container";

export function SearchTiers() {
  return (
    <section id="search" className="bg-ink-sunken">
      <Container className="flex flex-col gap-[52px] py-[100px]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <h2 className="max-w-[640px] font-display text-[42px] leading-[1.1] font-semibold tracking-[-0.03em] text-paper">
            Grep works immediately. Ranked search needs an index.
          </h2>
          <p className="max-w-[280px] font-body text-sm text-faint lg:text-right">
            Start with grep. Index when you want ranking or filters.
          </p>
        </div>
        <div className="flex flex-col">
          {searchTiers.map((tier) => (
            <div
              key={tier.index}
              className="flex flex-col gap-6 border-t border-line-soft py-7 lg:flex-row lg:items-start lg:gap-10"
            >
              <span className="font-display text-[40px] leading-none font-semibold text-tier-index">
                {tier.index}
              </span>
              <div className="flex w-[220px] shrink-0 flex-col gap-[7px]">
                <h3 className="font-display text-[21px] font-semibold text-paper">{tier.name}</h3>
                <p className="font-mono text-[12.5px] text-coral">{tier.api}</p>
              </div>
              <p className="min-w-0 flex-1 font-body text-[15px] leading-relaxed text-soft">
                {tier.desc}
              </p>
              <Badge
                variant="secondary"
                className="rounded-full border-transparent bg-ink-raised px-[11px] py-1.5 font-mono text-[11.5px] font-normal text-soft"
              >
                {tier.badge}
              </Badge>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

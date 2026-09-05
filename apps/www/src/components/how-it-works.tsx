import { howItWorks } from "@/lib/site";
import { cn } from "@/lib/utils";

import { Container } from "./container";
import { ProviderMarks } from "./provider-icon";

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-ink">
      <Container className="flex flex-col gap-[60px] py-[100px]">
        <div className="flex flex-col gap-[18px]">
          <h2 className="max-w-[35ch] font-display text-[42px] leading-[1.1] font-semibold tracking-[-0.03em] text-balance text-paper">
            The current session can find a past session.
          </h2>
          <p className="max-w-[56ch] font-body text-base leading-relaxed text-pretty text-soft">
            Configure the client once. List, open, and search stay inside the chat you are already
            in.
          </p>
        </div>
        <dl className="grid grid-cols-1 border-t border-line-soft md:grid-cols-2">
          {howItWorks.map((feature, index) => (
            <div
              key={feature.title}
              className={cn(
                "flex flex-col gap-3.5 border-line-soft py-10",
                "not-first:border-t md:nth-2:border-t-0 md:nth-[n+3]:border-t",
                "md:odd:pr-12 md:even:border-l md:even:pl-12",
              )}
            >
              {index === 0 ? (
                <ProviderMarks className="text-paper" iconClassName="size-[15px]" />
              ) : null}
              <dt className="font-display text-[22px] font-semibold text-balance text-paper">
                {feature.title}
              </dt>
              <dd className="font-body text-base leading-relaxed text-pretty text-soft sm:text-[14.5px]">
                {feature.body}
              </dd>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  );
}

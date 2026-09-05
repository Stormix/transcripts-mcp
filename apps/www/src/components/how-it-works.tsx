import { howItWorks } from "@/lib/site";

import { Container } from "./container";

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-ink">
      <Container className="flex flex-col gap-[60px] py-[100px]">
        <div className="flex max-w-[620px] flex-col gap-[18px]">
          <h2 className="max-w-[520px] font-display text-[42px] leading-[1.1] font-semibold tracking-[-0.03em] text-paper">
            How a question becomes a result.
          </h2>
          <p className="font-body text-base leading-relaxed text-soft">
            Configure the client once. Everything after that happens inside the session you are
            already in.
          </p>
        </div>
        <div className="grid gap-0 md:grid-cols-4">
          {howItWorks.map((step) => (
            <div
              key={step.index}
              className="flex flex-col gap-3.5 border-line-soft pt-[26px] pr-8 pb-0 pl-0 md:border-l md:pl-8 md:first:border-l-0 md:first:pl-0"
            >
              <span className="font-mono text-xs font-medium text-coral">{step.index}</span>
              <h3 className="font-display text-[22px] font-semibold text-paper">{step.title}</h3>
              <p className="font-body text-[14.5px] leading-relaxed text-soft">{step.body}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

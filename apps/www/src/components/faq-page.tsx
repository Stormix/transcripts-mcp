import { faqItems } from "@/lib/site";

import { DocPage } from "./doc-page";

export function FaqPage() {
  return (
    <DocPage
      title="FAQ"
      lede="Install, grep versus index, semantic search, and which clients this server talks to."
    >
      {faqItems.map((item) => (
        <section key={item.question} className="border-t border-line-soft py-8">
          <h2 className="font-display text-[22px] font-semibold text-paper">{item.question}</h2>
          <p className="mt-3 font-body text-[15px] leading-relaxed text-soft">{item.answer}</p>
        </section>
      ))}
    </DocPage>
  );
}

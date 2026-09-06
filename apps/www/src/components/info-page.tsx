import { infoPages } from "../lib/info-pages";
import { DocPage } from "./doc-page";

export function InfoPage({ page }: { page: keyof typeof infoPages }) {
  const copy = infoPages[page];
  return (
    <DocPage title={copy.title} lede={copy.lede}>
      {copy.sections.map((section) => (
        <section key={section.title} className="mb-10">
          <h2 className="mb-4 text-xl font-semibold text-paper">{section.title}</h2>
          <p className="leading-relaxed text-soft">{section.body}</p>
          {"href" in section && (
            <a
              className="mt-4 inline-block text-paper underline underline-offset-4"
              href={section.href}
            >
              {section.label}
            </a>
          )}
        </section>
      ))}
    </DocPage>
  );
}

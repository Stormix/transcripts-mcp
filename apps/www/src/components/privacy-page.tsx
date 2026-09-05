import { privacyCopy, privacyEmail, privacyUpdatedIso } from "@/lib/site";

import { LegalLink, LegalList, LegalPage, LegalParagraph, type LegalSection } from "./legal-page";

function withEmail(text: string) {
  const [before, after] = text.split(privacyEmail);

  if (after === undefined) {
    return text;
  }

  return [before, <LegalLink key="email" href={`mailto:${privacyEmail}`} />, after];
}

function sections(): LegalSection[] {
  const copy = privacyCopy;

  return [
    {
      id: "who-we-are",
      title: copy.whoWeAre.title,
      content: (
        <>
          <LegalParagraph>{copy.whoWeAre.p1}</LegalParagraph>
          <LegalParagraph>{withEmail(copy.whoWeAre.p2)}</LegalParagraph>
        </>
      ),
    },
    {
      id: "scope",
      title: copy.scope.title,
      content: (
        <>
          <LegalParagraph>{copy.scope.p1}</LegalParagraph>
          <LegalParagraph>{copy.scope.p2}</LegalParagraph>
        </>
      ),
    },
    {
      id: "what-we-collect",
      title: copy.whatWeCollect.title,
      content: (
        <>
          <LegalParagraph>{copy.whatWeCollect.intro}</LegalParagraph>
          <LegalParagraph>{copy.whatWeCollect.technical}</LegalParagraph>
          <LegalParagraph>{copy.whatWeCollect.installs}</LegalParagraph>
        </>
      ),
    },
    {
      id: "why-we-use-it",
      title: copy.whyWeUseIt.title,
      content: <LegalParagraph>{copy.whyWeUseIt.body}</LegalParagraph>,
    },
    {
      id: "cookies",
      title: copy.cookies.title,
      content: <LegalParagraph>{copy.cookies.none}</LegalParagraph>,
    },
    {
      id: "who-else-sees-it",
      title: copy.whoElseSeesIt.title,
      content: (
        <>
          <LegalList>
            {copy.whoElseSeesIt.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </LegalList>
          <LegalParagraph>{copy.whoElseSeesIt.closing}</LegalParagraph>
        </>
      ),
    },
    {
      id: "where-it-is-processed",
      title: copy.transfers.title,
      content: <LegalParagraph>{copy.transfers.body}</LegalParagraph>,
    },
    {
      id: "retention",
      title: copy.retention.title,
      content: (
        <LegalParagraph>
          {copy.retention.body} See{" "}
          <LegalLink href="https://www.cloudflare.com/privacypolicy/">
            Cloudflare's privacy policy
          </LegalLink>{" "}
          for its retention criteria.
        </LegalParagraph>
      ),
    },
    {
      id: "your-rights",
      title: copy.yourRights.title,
      content: (
        <>
          <LegalParagraph>{copy.yourRights.p1}</LegalParagraph>
          <LegalParagraph>{withEmail(copy.yourRights.p2)}</LegalParagraph>
        </>
      ),
    },
    {
      id: "security",
      title: copy.security.title,
      content: <LegalParagraph>{copy.security.body}</LegalParagraph>,
    },
    {
      id: "children",
      title: copy.children.title,
      content: <LegalParagraph>{copy.children.body}</LegalParagraph>,
    },
    {
      id: "changes",
      title: copy.changes.title,
      content: <LegalParagraph>{copy.changes.body}</LegalParagraph>,
    },
  ];
}

export function PrivacyPage() {
  return (
    <LegalPage
      title={privacyCopy.title}
      summary={privacyCopy.summary}
      updatedIso={privacyUpdatedIso}
      sections={sections()}
    />
  );
}

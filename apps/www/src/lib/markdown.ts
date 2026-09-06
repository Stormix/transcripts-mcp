import type { PageId } from "./page";

import { infoPages } from "./info-pages";
import {
  faqItems,
  howItWorks,
  privacyCopy,
  privacyUpdatedIso,
  repoUrl,
  searchTiers,
  tools,
} from "./site";

export function markdownForPage(page: PageId): string {
  const links =
    "\n\n## Resources\n\n- [Developers](https://transcriptsmcp.dev/developers/)\n- [Agent guidance](https://transcriptsmcp.dev/llms.txt)\n- [Sitemap](https://transcriptsmcp.dev/sitemap.xml)\n";
  switch (page) {
    case "about":
    case "contact":
    case "developers": {
      const copy = infoPages[page];
      return `# ${copy.title}\n\n${copy.lede}\n\n${copy.sections.map((section) => `## ${section.title}\n\n${section.body}${"href" in section && section.href ? `\n\n[${section.label}](${section.href.startsWith("/") ? `https://transcriptsmcp.dev${section.href}` : section.href})` : ""}`).join("\n\n")}${links}`;
    }
    case "privacy": {
      const sections = [
        [privacyCopy.whoWeAre.title, privacyCopy.whoWeAre.p1, privacyCopy.whoWeAre.p2],
        [privacyCopy.scope.title, privacyCopy.scope.p1, privacyCopy.scope.p2],
        [
          privacyCopy.whatWeCollect.title,
          privacyCopy.whatWeCollect.intro,
          privacyCopy.whatWeCollect.technical,
          privacyCopy.whatWeCollect.installs,
        ],
        [privacyCopy.whyWeUseIt.title, privacyCopy.whyWeUseIt.body],
        [privacyCopy.cookies.title, privacyCopy.cookies.none],
        [
          privacyCopy.whoElseSeesIt.title,
          privacyCopy.whoElseSeesIt.items.join("\n\n"),
          privacyCopy.whoElseSeesIt.closing,
        ],
        [privacyCopy.transfers.title, privacyCopy.transfers.body],
        [
          privacyCopy.retention.title,
          `${privacyCopy.retention.body} See [Cloudflare's privacy policy](https://www.cloudflare.com/privacypolicy/) for its retention criteria.`,
        ],
        [privacyCopy.yourRights.title, privacyCopy.yourRights.p1, privacyCopy.yourRights.p2],
        [privacyCopy.security.title, privacyCopy.security.body],
        [privacyCopy.children.title, privacyCopy.children.body],
        [privacyCopy.changes.title, privacyCopy.changes.body],
      ];
      return `# ${privacyCopy.title}\n\nUpdated ${privacyUpdatedIso}\n\n${privacyCopy.summary}\n\n${sections.map(([title, ...body]) => `## ${title}\n\n${body.join("\n\n")}`).join("\n\n")}${links}`;
    }
    case "faq":
      return `# transcripts-mcp FAQ\n\n${faqItems.map((item) => `## ${item.question}\n\n${item.answer}`).join("\n\n")}${links}`;
    case "home":
      return `# transcripts-mcp\n\nSearch your Cursor, Claude Code, and Codex sessions. Find the fix, decision, or conversation from a previous session, right from your current chat.\n\n## How it works\n\n${howItWorks.map((step) => `### ${step.title}\n\n${step.body}`).join("\n\n")}\n\n## Configure\n\nLaunch the official npm executable with npx transcripts-mcp. In your MCP client's configuration, use:\n\n\`\`\`json\n{"mcpServers":{"transcripts":{"command":"npx","args":["-y","transcripts-mcp"]}}}\n\`\`\`\n\nFor semantic search use bunx --bun transcripts-mcp. No API key is required. This is a local stdio server, not a hosted HTTP service.\n\n## Search tiers\n\n${searchTiers.map((tier) => `### ${tier.name}\n\n${tier.desc}`).join("\n\n")}\n\n## Tools\n\n${tools.map((tool) => `### ${tool.name}\n\n${tool.desc}\n\nInputs: ${tool.inputs}`).join("\n\n")}\n\n[Source and installation guide](${repoUrl})\n\n[Official npm package](https://www.npmjs.com/package/transcripts-mcp)${links}`;
  }
}

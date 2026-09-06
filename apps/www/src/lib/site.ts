export const repoUrl = "https://github.com/Stormix/transcripts-mcp";
export const docsUrl = `${repoUrl}#readme`;
export const packageName = "transcripts-mcp";
export const launchCommand = `npx ${packageName}`;

export const navLinks = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#tools", label: "Tools" },
  { href: "#search", label: "Search" },
  { href: "#configure", label: "Configure" },
] as const;

export type ClientId = "cursor" | "claude-code" | "codex";

export interface ClientConfig {
  id: ClientId;
  name: string;
  path: string;
}

export const clients: readonly ClientConfig[] = [
  { id: "cursor", name: "Cursor", path: "~/.cursor/mcp.json" },
  { id: "claude-code", name: "Claude Code", path: "~/.claude.json" },
  { id: "codex", name: "Codex", path: "~/.codex/config.toml" },
];

export const howItWorks = [
  {
    title: "The files are already there",
    body: "Cursor, Claude Code, and Codex append JSONL as you work. This server reads those files. Nothing extra to export.",
  },
  {
    title: "Same command in every client",
    body: "Paste the launch command into the MCP config and restart. Cursor, Claude Code, and Codex all take the same one.",
  },
  {
    title: "One shape for three formats",
    body: "Each tool writes a different JSONL. Adapters turn that into role, text, timestamp, and cwd.",
  },
  {
    title: "Grep now, rank later",
    body: "grep_transcripts scans the files immediately. search_transcripts ranks results from a local index. Run build_index to create or refresh it.",
  },
] as const;

export const searchTiers = [
  {
    index: "1",
    name: "grep",
    api: "grep_transcripts",
    desc: "Scan the raw session files. Literal, regex, or fuzzy. No index required.",
    badge: "No index",
  },
  {
    index: "2",
    name: "full-text",
    api: "search_transcripts",
    desc: "Ranked results over message text. Filter by provider, role, cwd, or date. Run build_index first.",
    badge: "build_index",
  },
  {
    index: "3",
    name: "semantic",
    api: 'mode: "hybrid"',
    desc: "Search by meaning, fused with full-text ranking. Needs a semantic build, and a server running under Bun.",
    badge: "semantic: true",
  },
] as const;

export const tools = [
  {
    name: "list_providers",
    desc: "Available transcript providers, with capped session file counts.",
    inputs: "—",
  },
  {
    name: "list_sessions",
    desc: "Recent sessions, newest first. Summaries only, not the full transcripts.",
    inputs: "provider? · cwd? · since? · until? · limit? (1–200, default 50)",
  },
  {
    name: "get_transcript",
    desc: "The messages in one session.",
    inputs: "provider · id · path? · limit? (1–1000, default 200)",
  },
  {
    name: "grep_transcripts",
    desc: "Search the raw files. No index required.",
    inputs: "query · mode? (plain | regex | fuzzy) · provider? · limit?",
  },
  {
    name: "search_transcripts",
    desc: "Ranked search. Needs build_index. Use hybrid after a semantic build.",
    inputs: "query · mode? (fts | hybrid) · provider? · role? · cwd? · since? · until? · limit?",
  },
  {
    name: "build_index",
    desc: "Create or refresh the search index. Pass full to rebuild from scratch.",
    inputs: "full? · semantic?",
  },
] as const;

export const providers = [
  { id: "cursor", home: "~/.cursor" },
  { id: "claude-code", home: "~/.claude" },
  { id: "codex", home: "~/.codex" },
] as const;

export const privacyPath = "/privacy/";
export const faqPath = "/faq/";

export const footerPages = [
  { label: "Developers", href: "/developers/" },
  { label: "About", href: "/about/" },
  { label: "Contact", href: "/contact/" },
  { label: "Privacy", href: privacyPath },
  { label: "FAQ", href: faqPath },
] as const;

export const footerProject = [
  { label: "GitHub", href: repoUrl },
  { label: "License", href: `${repoUrl}/blob/main/LICENSE` },
] as const;

export const privacyEmail = "hello@stormix.co";
export const privacyUpdatedIso = "2026-09-06";

export const privacyCopy = {
  title: "Privacy policy",
  summary: "How this site handles personal data and how to contact us about it.",
  whoWeAre: {
    title: "Who we are",
    p1: "The maintainer of transcripts-mcp is the data controller for the personal data described here.",
    p2: `For anything in this policy, write to ${privacyEmail}.`,
  },
  scope: {
    title: "What this policy covers",
    p1: "This policy covers transcriptsmcp.dev. It does not cover the MCP server on your machine: that process reads local session files and may write a local search index. The server returns transcript text to your MCP client, which may send it to its model provider according to its own settings.",
    p2: "It does not cover copies someone else hosts from the source, or GitHub if you open an issue or star the repo.",
  },
  whatWeCollect: {
    title: "What we collect",
    intro: "This site has no accounts, no forms, and no mailing list.",
    technical:
      "Cloudflare sees your IP address, user agent, and the URL you requested, to serve the page and block abuse. Google sees your IP address when the page loads fonts.",
    installs:
      "Installing the package fetches files from npm. The first semantic index build downloads an embedding model from Hugging Face. Those requests come from your machine. We do not receive them, or your transcripts.",
  },
  whyWeUseIt: {
    title: "Why we use it, and on what legal basis",
    body: "To serve the site and stop abuse. Legal basis: legitimate interest in running the site. We do not sell the data. We do not run analytics or ads.",
  },
  cookies: {
    title: "Cookies and browser storage",
    none: "No first-party cookies and no local storage. Google Fonts still sends your IP to Google.",
  },
  whoElseSeesIt: {
    title: "Who else processes it",
    items: [
      "Cloudflare hosts the site.",
      "Google serves the fonts.",
      "npm serves the package when you install it.",
      "Hugging Face serves the embedding model if you build a semantic index.",
    ],
    closing: "We do not share personal data with anyone else unless the law requires it.",
  },
  transfers: {
    title: "Where it is processed",
    body: "Cloudflare and Google run globally, so that technical data may be processed in other countries.",
  },
  retention: {
    title: "How long we keep it",
    body: "Cloudflare retains personal data according to the purposes for which it is processed and applicable legal obligations. Retention varies by data type and service.",
  },
  yourRights: {
    title: "Your rights",
    p1: "You can ask for a copy of your data, a correction, deletion, restriction, or to object.",
    p2: `Write to ${privacyEmail}. We will answer within a month. You can also complain to the data protection authority where you live.`,
  },
  security: {
    title: "Security",
    body: "The site is served over HTTPS. There is no account database. The MCP server runs on your machine; those files are yours to protect.",
  },
  children: {
    title: "Children",
    body: "This product is not directed at children. We do not knowingly collect data from anyone under 16. If a child sent us personal data, tell us and we will delete it.",
  },
  changes: {
    title: "Changes to this policy",
    body: "The date at the top is the current version. If a change materially affects you, we will say so on the site first.",
  },
} as const;

export const faqItems = [
  {
    question: "What does it search?",
    answer:
      "It searches session transcripts saved by Cursor, Claude Code, and Codex. Your current client can read the retrieved conversations to recover context from earlier work.",
  },
  {
    question: "Which clients can use it?",
    answer:
      "MCP clients that support local stdio servers, including Cursor, Claude Code, and Codex. The setup section includes configurations for these clients.",
  },
  {
    question: "Is it hosted?",
    answer: "No. The server runs on your machine and reads your local transcript files.",
  },
  {
    question: "Do I need an index?",
    answer:
      "Not for grep. grep_transcripts scans the files immediately. Run build_index when you want ranked full-text. Semantic and hybrid need a semantic build, and the server running under Bun.",
  },
  {
    question: "Why doesn't hybrid work with npx?",
    answer:
      "The npx platform binary cannot embed sqlite-vec or the ONNX engine. Run the server with bunx --bun transcripts-mcp to use semantic search.",
  },
  {
    question: "Does it modify my transcripts?",
    answer:
      "No. It reads transcripts without modifying them. Indexed search stores message text and optional embeddings locally; semantic search also downloads and caches model files.",
  },
  {
    question: "How do I install it?",
    answer:
      "On the site, Cursor and VS Code are one-click install links. Claude Code, Gemini, and Codex copy a CLI command. Claude Desktop, Windsurf, and Manual copy the mcpServers JSON. ChatGPT connectors need a remote HTTPS URL, which this local stdio server does not have. The repository also includes a Cursor plugin.",
  },
  {
    question: "Can I change the paths?",
    answer: "CURSOR_HOME, CLAUDE_HOME, CODEX_HOME, and TRANSCRIPTS_MCP_INDEX.",
  },
  {
    question: "What's the license?",
    answer: "MIT.",
  },
] as const;

import { packageName } from "./site";

export type InstallClientId =
  | "cursor"
  | "vscode"
  | "claude-desktop"
  | "claude-code"
  | "gemini"
  | "codex"
  | "windsurf"
  | "chatgpt"
  | "manual";

export type InstallAction = "deeplink" | "copy-cli" | "copy-config" | "remote-note";

export type SnippetKind = "json" | "toml" | "cli" | "note";

export interface InstallClient {
  id: InstallClientId;
  name: string;
  subtitle: string;
  action: InstallAction;
  snippetKind: SnippetKind;
  path: string;
  copyValue: string;
  href: string | null;
}

export const serverName = "transcripts";

export const mcpServersJson = `{
  "mcpServers": {
    "transcripts": {
      "command": "npx",
      "args": ["-y", "${packageName}"]
    }
  }
}`;

export const claudeCli = `claude mcp add --scope user transcripts -- npx -y ${packageName}`;
export const geminiCli = `gemini mcp add --scope user transcripts npx -y ${packageName}`;
export const codexCli = `codex mcp add transcripts -- npx -y ${packageName}`;

export const chatgptNote =
  "ChatGPT connectors need a remote HTTPS MCP URL. This server runs locally over stdio and reads files on this machine.";

const stdioConfigJson = JSON.stringify({
  command: "npx",
  args: ["-y", packageName],
});

export function cursorInstallUrl(): string {
  return `https://cursor.com/en/install-mcp?name=${encodeURIComponent(serverName)}&config=${encodeURIComponent(btoa(stdioConfigJson))}`;
}

export function vscodeInstallUrl(): string {
  const payload = JSON.stringify({
    name: serverName,
    command: "npx",
    args: ["-y", packageName],
  });
  return `https://insiders.vscode.dev/redirect/mcp/install?${encodeURIComponent(payload)}`;
}

export const installClients: readonly InstallClient[] = [
  {
    id: "cursor",
    name: "Cursor",
    subtitle: "One-click install",
    action: "deeplink",
    snippetKind: "json",
    path: "~/.cursor/mcp.json",
    copyValue: mcpServersJson,
    href: cursorInstallUrl(),
  },
  {
    id: "vscode",
    name: "VS Code",
    subtitle: "One-click install",
    action: "deeplink",
    snippetKind: "json",
    path: ".vscode/mcp.json",
    copyValue: mcpServersJson,
    href: vscodeInstallUrl(),
  },
  {
    id: "claude-desktop",
    name: "Claude Desktop",
    subtitle: "Copy configuration",
    action: "copy-config",
    snippetKind: "json",
    path: "~/Library/Application Support/Claude/claude_desktop_config.json",
    copyValue: mcpServersJson,
    href: null,
  },
  {
    id: "claude-code",
    name: "Claude Code",
    subtitle: "Copy CLI command",
    action: "copy-cli",
    snippetKind: "cli",
    path: "claude mcp add",
    copyValue: claudeCli,
    href: null,
  },
  {
    id: "gemini",
    name: "Gemini",
    subtitle: "Copy CLI command",
    action: "copy-cli",
    snippetKind: "cli",
    path: "gemini mcp add",
    copyValue: geminiCli,
    href: null,
  },
  {
    id: "codex",
    name: "Codex",
    subtitle: "Copy CLI command",
    action: "copy-cli",
    snippetKind: "cli",
    path: "codex mcp add",
    copyValue: codexCli,
    href: null,
  },
  {
    id: "windsurf",
    name: "Windsurf",
    subtitle: "Copy configuration",
    action: "copy-config",
    snippetKind: "json",
    path: "~/.codeium/windsurf/mcp_config.json",
    copyValue: mcpServersJson,
    href: null,
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    subtitle: "Add via Settings → Connectors",
    action: "remote-note",
    snippetKind: "note",
    path: "Settings → Connectors",
    copyValue: chatgptNote,
    href: null,
  },
  {
    id: "manual",
    name: "Manual",
    subtitle: "Copy configuration",
    action: "copy-config",
    snippetKind: "json",
    path: "mcp.json",
    copyValue: mcpServersJson,
    href: null,
  },
];

export function installClientById(id: InstallClientId): InstallClient {
  for (const client of installClients) {
    if (client.id === id) {
      return client;
    }
  }

  throw new Error(`Unknown install client: ${id}`);
}

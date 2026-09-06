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

type InstallAction = "deeplink" | "copy-cli" | "copy-config" | "remote-note";

export type SnippetKind = "json" | "toml" | "cli" | "note" | "prompt";

interface InstallPanel {
  snippetKind: SnippetKind;
  path: string;
  copyValue: string;
}

export interface InstallClient extends InstallPanel {
  id: InstallClientId;
  name: string;
  subtitle: string;
  action: InstallAction;
  href: string | null;
}

const serverName = "transcripts";

export const agentPromptId = "agent-prompt";

export type InstallPanelId = InstallClientId | typeof agentPromptId;

const mcpServersJson = `{
  "mcpServers": {
    "transcripts": {
      "command": "npx",
      "args": ["-y", "${packageName}"]
    }
  }
}`;

const claudeCli = `claude mcp add --scope user transcripts -- npx -y ${packageName}`;
const geminiCli = `gemini mcp add --scope user transcripts npx -y ${packageName}`;
const codexCli = `codex mcp add transcripts -- npx -y ${packageName}`;

export const agentInstallPrompt = `Install the ${packageName} MCP server for me. Do not ask me any questions: make the change yourself, then tell me what you did.

${packageName} is a local stdio MCP server that searches Cursor, Claude Code, and Codex session transcripts. It runs through npx, so there is nothing to clone or build.

1. Work out which MCP client you are running inside, then use the matching setup.
   - Claude Code: run \`${claudeCli}\`
   - Codex: run \`${codexCli}\`
   - Gemini CLI: run \`${geminiCli}\`
   - Cursor: edit ~/.cursor/mcp.json
   - VS Code: edit .vscode/mcp.json
   - Windsurf: edit ~/.codeium/windsurf/mcp_config.json
   - Claude Desktop: edit ~/Library/Application Support/Claude/claude_desktop_config.json on macOS, or %APPDATA%\\Claude\\claude_desktop_config.json on Windows
   - Anything else: edit that client's own MCP config file.

2. For a config file, create it if it is missing and merge this server into the existing server map. Keep every server that is already configured and leave the file valid JSON. Use the key the client expects: VS Code calls it "servers", the others call it "mcpServers".

${mcpServersJson}

3. Read the file back, confirm it still parses, and confirm both "${serverName}" and the servers that were there before are present.

4. Report the exact file you edited or the command you ran, and tell me to restart the client so it picks the server up.

The server exposes list_providers, list_sessions, get_transcript, grep_transcripts, search_transcripts, and build_index. grep_transcripts needs no index; run build_index before search_transcripts.`;

const agentPromptPanel: InstallPanel = {
  snippetKind: "prompt",
  path: "Prompt for your coding agent",
  copyValue: agentInstallPrompt,
};

const chatgptNote =
  "ChatGPT connectors need a remote HTTPS MCP URL. This server runs locally over stdio and reads files on this machine.";

const stdioConfigJson = JSON.stringify({
  command: "npx",
  args: ["-y", packageName],
});

export function cursorInstallUrl(): string {
  return `https://cursor.com/en/install-mcp?name=${encodeURIComponent(serverName)}&config=${encodeURIComponent(btoa(stdioConfigJson))}`;
}

function vscodeInstallUrl(): string {
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

function installClientById(id: InstallClientId): InstallClient {
  for (const client of installClients) {
    if (client.id === id) {
      return client;
    }
  }

  throw new Error(`Unknown install client: ${id}`);
}

export function installPanelById(id: InstallPanelId): InstallPanel {
  if (id === agentPromptId) {
    return agentPromptPanel;
  }

  return installClientById(id);
}

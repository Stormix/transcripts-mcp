import { describe, expect, it } from "vitest";

import {
  chatgptNote,
  claudeCli,
  codexCli,
  cursorInstallUrl,
  geminiCli,
  installClients,
  mcpServersJson,
  serverName,
  vscodeInstallUrl,
} from "../lib/install";

describe("cursorInstallUrl", () => {
  it("should encode the inner stdio config as url-safe base64", () => {
    expect(cursorInstallUrl()).toBe(
      "https://cursor.com/en/install-mcp?name=transcripts&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsInRyYW5zY3JpcHRzLW1jcCJdfQ%3D%3D",
    );
  });

  it("should omit the mcpServers wrapper from the config query", () => {
    const url = new URL(cursorInstallUrl());
    const config = url.searchParams.get("config");
    expect(url.searchParams.get("name")).toBe(serverName);
    expect(config).toBe("eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsInRyYW5zY3JpcHRzLW1jcCJdfQ==");
    expect(config?.includes("mcpServers")).toBe(false);
  });
});

describe("vscodeInstallUrl", () => {
  it("should put the named stdio payload in the redirect query", () => {
    expect(vscodeInstallUrl()).toBe(
      "https://insiders.vscode.dev/redirect/mcp/install?%7B%22name%22%3A%22transcripts%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22transcripts-mcp%22%5D%7D",
    );
  });

  it("should include the server name in the encoded payload", () => {
    const encoded = vscodeInstallUrl().slice(
      "https://insiders.vscode.dev/redirect/mcp/install?".length,
    );
    expect(decodeURIComponent(encoded)).toBe(
      '{"name":"transcripts","command":"npx","args":["-y","transcripts-mcp"]}',
    );
  });
});

describe("installClients", () => {
  it("should use the documented CLI strings", () => {
    expect(claudeCli).toBe("claude mcp add --scope user transcripts -- npx -y transcripts-mcp");
    expect(geminiCli).toBe("gemini mcp add --scope user transcripts npx -y transcripts-mcp");
    expect(codexCli).toBe("codex mcp add transcripts -- npx -y transcripts-mcp");
  });

  it("should point Cursor and VS Code at HTTPS install URLs", () => {
    const cursor = installClients.find((client) => client.id === "cursor");
    const vscode = installClients.find((client) => client.id === "vscode");
    expect(cursor?.href).toBe(cursorInstallUrl());
    expect(vscode?.href).toBe(vscodeInstallUrl());
    expect(cursor?.copyValue).toBe(mcpServersJson);
  });

  it("should keep ChatGPT as a remote-only note", () => {
    const chatgpt = installClients.find((client) => client.id === "chatgpt");
    expect(chatgpt?.action).toBe("remote-note");
    expect(chatgpt?.href).toBeNull();
    expect(chatgpt?.copyValue).toBe(chatgptNote);
  });
});

import {
  agentInstallPrompt,
  agentPromptId,
  installClients,
  installPanelById,
  type InstallClient,
  type InstallClientId,
  type InstallPanelId,
  type SnippetKind,
} from "@/lib/install";
import { packageName } from "@/lib/site";
import { cn } from "cn";
import { Braces, Check, ChevronRight, Copy, Sparkles, Terminal } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Container } from "./container";
import { CopyButton } from "./copy-button";
import { InstallClientIcon } from "./install-client-icon";
import { Button } from "./ui/button";

export function Install() {
  const [selected, setSelected] = useState<InstallPanelId>("cursor");
  const [copiedId, setCopiedId] = useState<InstallPanelId | null>(null);
  const active = installPanelById(selected);

  return (
    <section id="configure" className="bg-ink-sunken">
      <Container className="flex flex-col gap-[72px] py-[100px] lg:flex-row">
        <div className="flex w-full max-w-[520px] flex-col gap-5">
          <h2 className="font-display text-[42px] leading-[1.1] font-semibold tracking-[-0.03em] text-paper">
            Find your next answer in an old session.
          </h2>
          <p className="max-w-[460px] font-body text-base leading-relaxed text-soft">
            Hand the setup to your agent, or choose your client and copy its configuration.
          </p>
          <AgentPromptCard
            active={selected === agentPromptId}
            copied={copiedId === agentPromptId}
            onSelect={setSelected}
            onCopied={setCopiedId}
          />
          <div className="flex items-center gap-4 pt-1">
            <span className="h-px flex-1 bg-line-soft" />
            <span className="font-body text-[12.5px] text-faint">or set it up yourself</span>
            <span className="h-px flex-1 bg-line-soft" />
          </div>
          <div className="flex flex-col">
            {installClients
              .filter((client) => client.action !== "remote-note")
              .map((client) => (
                <ClientRow
                  key={client.id}
                  client={client}
                  selected={selected}
                  copied={copiedId === client.id}
                  onSelect={setSelected}
                  onCopied={setCopiedId}
                />
              ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-5 lg:sticky lg:top-8 lg:self-start">
          <div className="relative overflow-hidden rounded-xl bg-ink">
            <div className="flex items-center gap-2.5 px-4 py-3">
              <SnippetIcon kind={active.snippetKind} />
              <span className="flex-1 truncate font-mono text-xs text-soft">{active.path}</span>
              <CopyButton value={active.copyValue} />
            </div>
            <pre
              key={selected}
              data-lenis-prevent
              className={cn(
                "config-snippet overflow-x-auto px-4 pt-1 pb-[18px] font-mono text-[12.5px] leading-[1.7]",
                active.snippetKind === "prompt" && "max-h-[420px] overflow-y-auto lg:max-h-[560px]",
              )}
            >
              <Snippet kind={active.snippetKind} value={active.copyValue} />
            </pre>
            {active.snippetKind === "prompt" ? (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-ink to-transparent"
              />
            ) : null}
          </div>
        </div>
      </Container>
    </section>
  );
}

function AgentPromptCard({
  active,
  copied,
  onSelect,
  onCopied,
}: {
  active: boolean;
  copied: boolean;
  onSelect: (id: InstallPanelId) => void;
  onCopied: (id: InstallPanelId | null) => void;
}) {
  return (
    <Button
      type="button"
      variant="bare"
      size="auto"
      onClick={() => {
        onSelect(agentPromptId);
        void copyText(agentInstallPrompt, agentPromptId, onCopied);
      }}
      className={cn(
        "group flex w-full cursor-pointer items-center gap-3.5 rounded-xl border px-4 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/50 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-sunken",
        active
          ? "border-coral bg-coral/12"
          : "border-line bg-coral/[0.04] hover:border-coral/40 hover:bg-coral/10",
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-coral/15 text-coral">
        <Sparkles className="size-[17px]" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-body text-[15px] font-medium text-paper">
          Let your agent install it
        </span>
        <span className="font-body text-[12.5px] text-faint">
          One prompt, no config file to edit yourself.
        </span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-2 rounded-md bg-coral px-3 py-2 font-body text-[13px] font-semibold text-ink transition-colors group-hover:bg-paper">
        {copied ? <Check className="size-[14px]" /> : <Copy className="size-[14px]" />}
        {copied ? "Copied" : "Copy prompt"}
      </span>
    </Button>
  );
}

function ClientRow({
  client,
  selected,
  copied,
  onSelect,
  onCopied,
}: {
  client: InstallClient;
  selected: InstallPanelId;
  copied: boolean;
  onSelect: (id: InstallClientId) => void;
  onCopied: (id: InstallPanelId | null) => void;
}) {
  const isActive = client.id === selected;
  const className =
    "flex w-full cursor-pointer items-center gap-3 border-b border-line-soft py-[15px] text-left last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/50 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-sunken";

  const body = (
    <>
      <InstallClientIcon id={client.id} className="size-[15px]" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className={
            isActive
              ? "font-body text-[15px] font-medium text-paper"
              : "font-body text-[15px] text-soft"
          }
        >
          {client.name}
        </span>
        <span className="font-body text-[12.5px] text-faint">{client.subtitle}</span>
      </span>
      {copied ? (
        <Check className="size-[14px] text-paper" />
      ) : (
        <ChevronRight className={isActive ? "size-[14px] text-paper" : "size-[14px] text-faint"} />
      )}
    </>
  );

  if (client.href !== null) {
    return (
      <Button asChild variant="bare" size="auto" className={className}>
        <a
          href={client.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            onSelect(client.id);
          }}
        >
          {body}
        </a>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="bare"
      size="auto"
      className={className}
      onClick={() => {
        onSelect(client.id);
        void copyText(client.copyValue, client.id, onCopied);
      }}
    >
      {body}
    </Button>
  );
}

async function copyText(
  value: string,
  id: InstallPanelId,
  onCopied: (id: InstallPanelId | null) => void,
) {
  try {
    await navigator.clipboard.writeText(value);
    onCopied(id);
    window.setTimeout(() => {
      onCopied(null);
    }, 1600);
  } catch {
    onCopied(null);
  }
}

function SnippetIcon({ kind }: { kind: SnippetKind }) {
  switch (kind) {
    case "cli":
      return <Terminal className="size-[14px] text-faint" />;
    case "prompt":
      return <Sparkles className="size-[14px] text-coral" />;
    case "json":
    case "toml":
    case "note":
      return <Braces className="size-[14px] text-faint" />;
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

function Snippet({ kind, value }: { kind: SnippetKind; value: string }) {
  switch (kind) {
    case "json":
      return <JsonSnippet />;
    case "toml":
      return <TomlSnippet />;
    case "cli":
      return (
        <code>
          <span className="text-coral">$</span> <span className="text-soft">{value}</span>
        </code>
      );
    case "note":
      return <code className="text-soft whitespace-pre-wrap">{value}</code>;
    case "prompt":
      return <PromptSnippet value={value} />;
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

const stepLinePattern = /^\d+\./;

function PromptSnippet({ value }: { value: string }) {
  return (
    <code className="block whitespace-pre-wrap">
      {value.split("\n").map((line, index) => (
        <span
          key={`${String(index)}-${line}`}
          className={cn(
            "block",
            stepLinePattern.test(line) ? "text-paper" : "text-soft",
            line.length === 0 && "h-[0.85em]",
          )}
        >
          {line}
        </span>
      ))}
    </code>
  );
}

function JsonSnippet() {
  return (
    <code>
      <Line>
        <Dim>{"{"}</Dim>
      </Line>
      <Line indent>
        <Paper>"mcpServers"</Paper>
        <Dim>{": {"}</Dim>
      </Line>
      <Line indent2>
        <Paper>"transcripts"</Paper>
        <Dim>{": {"}</Dim>
      </Line>
      <Line indent3>
        <Paper>"command"</Paper>
        <Dim>: </Dim>
        <Paper>"npx"</Paper>
        <Dim>,</Dim>
      </Line>
      <Line indent3>
        <Paper>"args"</Paper>
        <Dim>{": ["}</Dim>
        <Paper>"-y"</Paper>
        <Dim>, </Dim>
        <Paper>"{packageName}"</Paper>
        <Dim>]</Dim>
      </Line>
      <Line indent2>
        <Dim>{"}"}</Dim>
      </Line>
      <Line indent>
        <Dim>{"}"}</Dim>
      </Line>
      <Line>
        <Dim>{"}"}</Dim>
      </Line>
    </code>
  );
}

function TomlSnippet() {
  return (
    <code>
      <Line>
        <Dim>[mcp_servers.transcripts]</Dim>
      </Line>
      <Line>
        <Paper>command</Paper>
        <Dim> = </Dim>
        <Paper>"npx"</Paper>
      </Line>
      <Line>
        <Paper>args</Paper>
        <Dim> = [</Dim>
        <Paper>"-y"</Paper>
        <Dim>, </Dim>
        <Paper>"{packageName}"</Paper>
        <Dim>]</Dim>
      </Line>
    </code>
  );
}

function Line({
  children,
  indent = false,
  indent2 = false,
  indent3 = false,
}: {
  children: ReactNode;
  indent?: boolean;
  indent2?: boolean;
  indent3?: boolean;
}) {
  const pad = indent3 ? "pl-12" : indent2 ? "pl-8" : indent ? "pl-4" : "";
  return <div className={pad}>{children}</div>;
}

function Paper({ children }: { children: ReactNode }) {
  return <span className="text-paper">{children}</span>;
}

function Dim({ children }: { children: ReactNode }) {
  return <span className="text-faint">{children}</span>;
}

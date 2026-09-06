import {
  installClientById,
  installClients,
  type InstallClient,
  type InstallClientId,
  type SnippetKind,
} from "@/lib/install";
import { packageName } from "@/lib/site";
import { Braces, Check, ChevronRight, Terminal } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Container } from "./container";
import { CopyButton } from "./copy-button";
import { InstallClientIcon } from "./install-client-icon";
import { Button } from "./ui/button";

export function Install() {
  const [selected, setSelected] = useState<InstallClientId>("cursor");
  const [copiedId, setCopiedId] = useState<InstallClientId | null>(null);
  const active = installClientById(selected);

  return (
    <section id="configure" className="bg-ink-sunken">
      <Container className="flex flex-col gap-[72px] py-[100px] lg:flex-row">
        <div className="flex w-full max-w-[520px] flex-col gap-5">
          <h2 className="font-display text-[42px] leading-[1.1] font-semibold tracking-[-0.03em] text-paper">
            Find your next answer in an old session.
          </h2>
          <p className="max-w-[460px] font-body text-base leading-relaxed text-soft">
            Choose your client to install or copy its configuration.
          </p>
          <div className="flex flex-col pt-4">
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
          <div className="overflow-hidden rounded-xl bg-ink">
            <div className="flex items-center gap-2.5 px-4 py-3">
              {active.snippetKind === "cli" ? (
                <Terminal className="size-[14px] text-faint" />
              ) : (
                <Braces className="size-[14px] text-faint" />
              )}
              <span className="flex-1 truncate font-mono text-xs text-soft">{active.path}</span>
              <CopyButton value={active.copyValue} />
            </div>
            <pre
              key={selected}
              className="config-snippet overflow-x-auto px-4 pt-1 pb-[18px] font-mono text-[12.5px] leading-[1.7]"
            >
              <Snippet kind={active.snippetKind} value={active.copyValue} />
            </pre>
          </div>
        </div>
      </Container>
    </section>
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
  selected: InstallClientId;
  copied: boolean;
  onSelect: (id: InstallClientId) => void;
  onCopied: (id: InstallClientId | null) => void;
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
  id: InstallClientId,
  onCopied: (id: InstallClientId | null) => void,
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
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
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

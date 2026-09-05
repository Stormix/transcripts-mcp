import { clients, packageName, type ClientConfig, type ClientId } from "@/lib/site";
import { Braces, ChevronsRight } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Container } from "./container";
import { CopyButton } from "./copy-button";
import { ProviderIcon } from "./provider-icon";

export function Install() {
  const [selected, setSelected] = useState<ClientId>("cursor");
  const active = clientById(selected);
  const snippet = snippetFor(selected);

  return (
    <section id="configure" className="bg-ink-sunken">
      <Container className="flex flex-col gap-[72px] py-[100px] lg:flex-row">
        <div className="flex w-full max-w-[520px] flex-col gap-5">
          <h2 className="font-display text-[42px] leading-[1.1] font-semibold tracking-[-0.03em] text-paper">
            The same command in three config files.
          </h2>
          <p className="max-w-[460px] font-body text-base leading-relaxed text-soft">
            Paste the block into the client's config and restart it. npx fetches the package on the
            first run.
          </p>
          <div className="flex flex-col pt-4">
            {clients.map((client) => {
              const isActive = client.id === selected;
              return (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => setSelected(client.id)}
                  className="flex cursor-pointer items-center gap-3 border-b border-line-soft py-[15px] text-left last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/50 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-sunken"
                >
                  <ProviderIcon
                    id={client.id}
                    className={isActive ? "size-[15px] text-paper" : "size-[15px] text-faint"}
                  />
                  <span
                    className={
                      isActive
                        ? "font-body text-[15px] font-medium text-paper"
                        : "font-body text-[15px] text-soft"
                    }
                  >
                    {client.name}
                  </span>
                  <span className="ml-auto font-mono text-xs text-faint">{client.path}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <div className="overflow-hidden rounded-xl bg-ink">
            <div className="flex items-center gap-2.5 px-4 py-3">
              <Braces className="size-[14px] text-faint" />
              <span className="flex-1 font-mono text-xs text-soft">{active.path}</span>
              <CopyButton value={snippet} />
            </div>
            <pre className="overflow-x-auto px-4 pt-1 pb-[18px] font-mono text-[12.5px] leading-[1.7]">
              <Snippet clientId={selected} />
            </pre>
          </div>
          <div className="flex flex-col gap-3.5 rounded-xl px-5 py-5">
            <div className="flex items-center gap-2">
              <ChevronsRight className="size-[14px] text-faint" />
              <span className="font-mono text-[10.5px] font-medium tracking-[0.08em] text-soft">
                OR FROM THE CLI
              </span>
            </div>
            <CliLine command={`claude mcp add --scope user transcripts -- npx -y ${packageName}`} />
            <CliLine command={`codex mcp add transcripts -- npx -y ${packageName}`} />
          </div>
        </div>
      </Container>
    </section>
  );
}

function CliLine({ command }: { command: string }) {
  return (
    <p className="flex gap-2.5 font-mono text-[12.5px]">
      <span className="text-coral">$</span>
      <span className="text-soft">{command}</span>
    </p>
  );
}

function clientById(id: ClientId): ClientConfig {
  for (const client of clients) {
    if (client.id === id) {
      return client;
    }
  }

  throw new Error(`Unknown client: ${id}`);
}

function snippetFor(clientId: ClientId): string {
  switch (clientId) {
    case "cursor":
    case "claude-code":
      return `{
  "mcpServers": {
    "transcripts": {
      "command": "npx",
      "args": ["-y", "${packageName}"]
    }
  }
}`;
    case "codex":
      return `[mcp_servers.transcripts]
command = "npx"
args = ["-y", "${packageName}"]`;
    default: {
      const exhaustive: never = clientId;
      return exhaustive;
    }
  }
}

function Snippet({ clientId }: { clientId: ClientId }) {
  switch (clientId) {
    case "cursor":
    case "claude-code":
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
    case "codex":
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
    default: {
      const exhaustive: never = clientId;
      return exhaustive;
    }
  }
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

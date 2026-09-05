import { tools } from "@/lib/site";

import { Container } from "./container";

export function ToolsTable() {
  return (
    <section id="tools" className="bg-ink">
      <Container className="pb-16 lg:pb-24">
        <details className="group border-y border-line">
          <summary className="cursor-pointer py-6 font-display text-2xl font-medium">
            Tool reference{" "}
            <span className="ml-3 text-base font-normal text-soft">Six MCP tools</span>
          </summary>
          <dl className="pb-6">
            {tools.map((tool) => (
              <div
                key={tool.name}
                className="grid gap-3 border-t border-line-soft py-5 lg:grid-cols-[250px_1fr] lg:gap-9"
              >
                <dt className="font-mono text-sm text-coral">{tool.name}</dt>
                <dd>
                  <p className="text-sm leading-relaxed text-soft">{tool.desc}</p>
                  <p className="mt-2 font-mono text-xs leading-relaxed break-words text-soft">
                    {tool.inputs}
                  </p>
                </dd>
              </div>
            ))}
          </dl>
        </details>
      </Container>
    </section>
  );
}

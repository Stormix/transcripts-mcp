import { tools } from "@/lib/site";

import { Container } from "./container";

export function ToolsTable() {
  return (
    <section id="tools" className="bg-ink">
      <Container className="flex flex-col gap-12 py-[100px]">
        <div className="flex max-w-[560px] flex-col gap-[18px]">
          <h2 className="font-display text-[42px] leading-[1.1] font-semibold tracking-[-0.03em] text-paper">
            List sessions, open one, or search.
          </h2>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-[250px_minmax(0,1fr)_340px] gap-9 border-b border-line-soft pb-3">
              <span className="font-mono text-[10.5px] font-medium tracking-[0.08em] text-faint">
                TOOL
              </span>
              <span className="font-mono text-[10.5px] font-medium tracking-[0.08em] text-faint">
                WHAT IT DOES
              </span>
              <span className="font-mono text-[10.5px] font-medium tracking-[0.08em] text-faint">
                INPUTS
              </span>
            </div>
            {tools.map((tool) => (
              <div
                key={tool.name}
                className="grid grid-cols-[250px_minmax(0,1fr)_340px] items-start gap-9 border-b border-line-soft py-5 last:border-b-0"
              >
                <div className="flex items-center gap-[9px]">
                  <span className="h-4 w-0.5 bg-coral" />
                  <span className="font-mono text-[13.5px] font-medium text-paper">
                    {tool.name}
                  </span>
                </div>
                <p className="font-body text-[14.5px] leading-relaxed text-soft">{tool.desc}</p>
                <p className="font-mono text-[11.5px] leading-relaxed text-faint">{tool.inputs}</p>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

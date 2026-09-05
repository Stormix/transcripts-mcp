import { providers } from "@/lib/site";

import { Container } from "./container";
import { ProviderIcon } from "./provider-icon";

export function Providers() {
  return (
    <section className="bg-ink">
      <Container>
        <div className="flex flex-col gap-8 border-y border-line-soft py-[30px] lg:flex-row lg:items-center">
          <div className="max-w-[400px]">
            <p className="font-body text-[14.5px] font-semibold text-paper">Where the files are</p>
            <p className="mt-1.5 font-body text-[13.5px] text-faint">
              Override any path with CURSOR_HOME, CLAUDE_HOME, or CODEX_HOME.
            </p>
          </div>
          <div className="flex flex-1 flex-wrap items-end gap-0 lg:justify-end">
            {providers.map((provider, index) => (
              <div key={provider.id} className="flex items-end">
                {index > 0 ? (
                  <span className="mx-[34px] hidden h-[38px] w-px bg-line-soft sm:block" />
                ) : null}
                <div className="flex flex-col gap-[7px]">
                  <span className="flex items-center gap-2">
                    <ProviderIcon id={provider.id} className="size-[15px] text-paper" />
                    <span className="font-mono text-[14.5px] font-medium text-paper">
                      {provider.id}
                    </span>
                  </span>
                  <span className="pl-[23px] font-mono text-[12.5px] text-faint">
                    {provider.home}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

import { Database, Folder, MessageSquare, Search, Terminal } from "lucide-react";

export function SessionPreview() {
  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[12px] bg-ink-sunken">
      <div className="flex items-center gap-2.5 bg-ink-raised px-4 py-[13px]">
        <Terminal className="size-[14px] text-faint" />
        <span className="font-mono text-xs text-faint">claude-code &nbsp;~/dev/checkout-api</span>
        <span className="ml-auto flex items-center gap-1.5 rounded-full bg-coral/10 px-2 py-1">
          <span className="size-[5px] rounded-full bg-coral" />
          <span className="font-mono text-[10.5px] text-coral">transcripts</span>
        </span>
      </div>

      <div className="flex flex-col gap-[18px] px-5 py-5">
        <div className="flex items-start gap-[11px]">
          <span className="font-mono text-sm font-medium text-coral">{">"}</span>
          <p className="font-body text-[14.5px] leading-relaxed text-paper">
            Find where I set up the idempotency key in the checkout work.
          </p>
        </div>

        <div className="overflow-hidden rounded-[10px] bg-ink-raised">
          <div className="flex flex-wrap items-center gap-2 px-[13px] py-2.5">
            <Search className="size-[13px] text-coral" />
            <span className="font-mono text-[12.5px] font-medium text-paper">
              search_transcripts
            </span>
            <span className="font-mono text-[11.5px] text-faint">
              {'{ query: "idempotency key", provider: "cursor" }'}
            </span>
          </div>
          <div className="flex flex-col gap-3 px-[13px] pt-0.5 pb-[13px]">
            <Hit
              accent
              meta="cursor · checkout-api · Aug 26"
              score="bm25 4.81"
              role="assistant"
              text="…use a client-supplied Idempotency-Key header and store it on the payment intent, so a replayed POST returns the original result…"
            />
            <Hit
              meta="cursor · checkout-api · Aug 28"
              score="bm25 3.92"
              role="user"
              text="does the idempotency key need to survive a retry after the 24h window?"
            />
          </div>
        </div>

        <p className="font-body text-[14.5px] leading-relaxed text-soft">
          Two matching messages, both in checkout-api. Want the full transcript for Aug 26?
          <span className="ml-1 font-mono text-coral">▌</span>
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 bg-ink-raised px-4 py-[11px]">
        <div className="flex flex-wrap items-center gap-[18px]">
          <FooterChip icon={Database} label="index: ~/.transcripts-mcp" />
          <FooterChip icon={MessageSquare} label="6 messages" />
          <FooterChip icon={Folder} label="2 sessions" />
        </div>
        <span className="font-mono text-[11px] text-faint">mode: fts</span>
      </div>
    </div>
  );
}

function Hit({
  accent = false,
  meta,
  score,
  role,
  text,
}: {
  accent?: boolean;
  meta: string;
  score: string;
  role: string;
  text: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className={accent ? "h-3 w-0.5 bg-coral" : "h-3 w-0.5 bg-line"} />
        <span className="font-mono text-[11.5px] text-soft">{meta}</span>
        <span className="ml-auto font-mono text-[11px] text-faint">{score}</span>
      </div>
      <p className="pl-2.5 font-mono text-[11.5px] leading-relaxed">
        <span className="text-coral">{role}</span>
        <span className="text-faint"> {text}</span>
      </p>
    </div>
  );
}

function FooterChip({ icon: Icon, label }: { icon: typeof Database; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-faint">
      <Icon className="size-3" />
      <span className="font-mono text-[11px]">{label}</span>
    </span>
  );
}

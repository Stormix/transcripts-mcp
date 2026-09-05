import { cn } from "cn";

export function LogoMark({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={cn(
        "flex flex-col justify-center rounded-[7px] bg-paper",
        compact ? "size-[26px] gap-[3.5px] px-[6.5px]" : "size-7 gap-[3.5px] px-[7px]",
      )}
      aria-hidden="true"
    >
      <span className="h-[2px] w-full rounded-full bg-ink" />
      <span className="h-[2px] w-full rounded-full bg-coral" />
      <span className={cn("h-[2px] rounded-full bg-ink", compact ? "w-[9px]" : "w-2.5")} />
    </span>
  );
}

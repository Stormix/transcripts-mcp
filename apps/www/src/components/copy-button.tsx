import { cn } from "cn";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyButton({
  value,
  className,
  iconClassName,
}: {
  value: string;
  className?: string;
  iconClassName?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
      }, 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn("text-faint transition-colors hover:text-paper", className)}
      aria-label={copied ? "Copied" : "Copy"}
    >
      {copied ? (
        <Check className={cn("size-[14px]", iconClassName)} />
      ) : (
        <Copy className={cn("size-[14px]", iconClassName)} />
      )}
    </button>
  );
}

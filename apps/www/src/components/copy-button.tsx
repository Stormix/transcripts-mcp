import { cn } from "cn";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "./ui/button";

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
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      onClick={handleCopy}
      className={cn("text-faint hover:bg-transparent hover:text-paper", className)}
      aria-label={copied ? "Copied" : "Copy"}
    >
      {copied ? (
        <Check className={cn("size-[14px]", iconClassName)} />
      ) : (
        <Copy className={cn("size-[14px]", iconClassName)} />
      )}
    </Button>
  );
}

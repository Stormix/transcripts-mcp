import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("mx-auto w-full max-w-[1440px] px-6 lg:px-14", className)}>{children}</div>
  );
}

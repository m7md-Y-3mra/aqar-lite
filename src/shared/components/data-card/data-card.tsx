import type { ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

/** White framed box for tables; the table scrolls inside it on small screens. */
export function DataCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 overflow-hidden rounded-xl border bg-card shadow-xs", className)}>
      {children}
    </div>
  );
}

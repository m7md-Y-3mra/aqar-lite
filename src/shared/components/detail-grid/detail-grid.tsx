import type { ReactNode } from "react";

/** A <dl> of label/value pairs; each child <div> holds one <dt> and one <dd>. */
export function DetailGrid({ children }: { children: ReactNode }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 [&_dd]:mt-1 [&_dd]:font-medium [&_dd]:tabular-nums [&_dt]:text-xs [&_dt]:text-muted-foreground [&>div]:rounded-xl [&>div]:border [&>div]:bg-card [&>div]:p-4">
      {children}
    </dl>
  );
}

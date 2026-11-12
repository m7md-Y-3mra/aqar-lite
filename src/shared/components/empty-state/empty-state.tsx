import type { ReactNode } from "react";

type EmptyStateProps = {
  message: string;
  action?: ReactNode;
};

export function EmptyState({ message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      {action}
    </div>
  );
}

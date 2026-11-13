"use client";

import Link from "next/link";

import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";

type ErrorStateProps = {
  message: string;
  onRetry?: () => void;
  resetHref?: string;
};

export function ErrorState({ message, onRetry, resetHref }: ErrorStateProps) {
  return (
    <Alert variant="destructive">
      <AlertDescription className="flex flex-wrap items-center gap-3">
        <span>{message}</span>
        {onRetry && (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            إعادة المحاولة
          </Button>
        )}
        {resetHref && (
          <Button variant="link" size="sm" asChild>
            <Link href={resetHref}>مسح الفلاتر</Link>
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

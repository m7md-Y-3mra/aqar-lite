"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/shared/components/ui/button";

type PaginationNavProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
};

export function PaginationNav({ page, pageSize, total, onPageChange }: PaginationNavProps) {
  // The empty state already tells the user there is nothing to page through.
  if (total === 0) return null;

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = Math.min((page - 1) * pageSize + 1, total);
  const to = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="التنقل بين الصفحات"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-sm text-muted-foreground">
        عرض <span className="font-medium text-foreground tabular-nums">{from}</span> إلى{" "}
        <span className="font-medium text-foreground tabular-nums">{to}</span> من{" "}
        <span className="font-medium text-foreground tabular-nums">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronRight aria-hidden="true" />
          السابق
        </Button>
        <span className="text-sm text-muted-foreground tabular-nums">
          صفحة {page} من {pageCount}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          التالي
          <ChevronLeft aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}

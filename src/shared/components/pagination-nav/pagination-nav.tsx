"use client";

import { Button } from "@/shared/components/ui/button";

type PaginationNavProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
};

export function PaginationNav({ page, pageSize, total, onPageChange }: PaginationNavProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <nav aria-label="التنقل بين الصفحات" className="flex items-center justify-between gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        السابق
      </Button>
      <span className="text-sm text-muted-foreground">
        صفحة {page} من {pageCount}
      </span>
      <Button
        type="button"
        variant="outline"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        التالي
      </Button>
    </nav>
  );
}

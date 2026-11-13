"use client";

import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { PaginationNav } from "@/shared/components/pagination-nav";
import { TableSkeleton } from "@/shared/components/table-skeleton";
import { AuditLogTable } from "./components/audit-log-table";
import { useAuditLogPage } from "./use-audit-log-page";

export function AuditLogPage() {
  const { query, valid, result, setPage } = useAuditLogPage();

  return (
    <section className="min-w-0 space-y-6">
      <h1 className="text-2xl font-semibold">سجل التدقيق</h1>
      {!valid ? (
        <ErrorState message="معايير البحث غير صحيحة. حاول مرة أخرى." resetHref="/audit-log" />
      ) : result.isPending ? (
        <TableSkeleton columns={4} />
      ) : result.isError ? (
        <ErrorState
          message="تعذر تحميل سجل التدقيق. حاول مرة أخرى."
          onRetry={() => void result.refetch()}
        />
      ) : (
        <>
          {result.data.items.length === 0 ? (
            <EmptyState message="لا توجد أحداث في السجل" />
          ) : (
            <AuditLogTable events={result.data.items} dimmed={result.isPlaceholderData} />
          )}
          <PaginationNav
            page={query.page}
            pageSize={query.pageSize}
            total={result.data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </section>
  );
}

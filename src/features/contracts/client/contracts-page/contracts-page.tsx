"use client";

import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { PaginationNav } from "@/shared/components/pagination-nav";
import { TableSkeleton } from "@/shared/components/table-skeleton";
import { ContractsTable } from "./components/contracts-table";
import { useContractsPage } from "./use-contracts-page";

export function ContractsPage() {
  const { query, valid, result, setPage } = useContractsPage();
  return (
    <section className="min-w-0 space-y-6">
      <h1 className="text-2xl font-semibold">العقود</h1>
      {!valid ? (
        <ErrorState message="معايير البحث غير صحيحة. امسح الفلاتر وحاول مرة أخرى." resetHref="/contracts" />
      ) : result.isPending ? (
        <TableSkeleton columns={7} />
      ) : result.isError ? (
        <ErrorState message="تعذر تحميل العقود. حاول مرة أخرى." onRetry={() => void result.refetch()} />
      ) : (
        <>
          {result.data.items.length === 0 ? <EmptyState message="لا توجد عقود بعد" /> : (
            <ContractsTable contracts={result.data.items} dimmed={result.isPlaceholderData} />
          )}
          <PaginationNav page={query.page} pageSize={query.pageSize} total={result.data.total} onPageChange={setPage} />
        </>
      )}
    </section>
  );
}

"use client";

import Link from "next/link";

import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { PaginationNav } from "@/shared/components/pagination-nav";
import { TableSkeleton } from "@/shared/components/table-skeleton";
import { buttonVariants } from "@/shared/components/ui/button";
import { UnitsFilters } from "./components/units-filters";
import { UnitsTable } from "./components/units-table";
import type { UnitsPageProps } from "./types";
import { useUnitsPage } from "./use-units-page";

export function UnitsPage({ role, reserveDialog }: UnitsPageProps) {
  const { query, valid, result, hasFilters, setFilters, setPage, openReserve } = useUnitsPage();

  return (
    <section className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">الوحدات</h1>
        {role === "MANAGER" && (
          <Link href="/units/new" className={buttonVariants()}>
            إضافة وحدة
          </Link>
        )}
      </div>
      {!valid ? (
        <ErrorState
          message="معايير البحث غير صحيحة. امسح الفلاتر وحاول مرة أخرى."
          resetHref="/units"
        />
      ) : (
        <>
          <UnitsFilters key={JSON.stringify(query)} query={query} onApply={setFilters} />
          {result.isPending ? (
            <TableSkeleton columns={role === "ACCOUNTANT" ? 7 : 8} />
          ) : result.isError ? (
            <ErrorState
              message="تعذر تحميل الوحدات. حاول مرة أخرى."
              onRetry={() => void result.refetch()}
            />
          ) : (
            <>
              {result.data.items.length === 0 ? (
                <EmptyState
                  message="لا توجد وحدات مطابقة"
                  action={
                    hasFilters ? (
                      <Link href="/units" className={buttonVariants({ variant: "link" })}>
                        مسح الفلاتر
                      </Link>
                    ) : undefined
                  }
                />
              ) : (
                <UnitsTable
                  units={result.data.items}
                  canEdit={role === "MANAGER"}
                  canReserve={role === "SALES"}
                  dimmed={result.isPlaceholderData}
                  onReserve={openReserve}
                />
              )}
              <PaginationNav
                page={query.page}
                pageSize={query.pageSize}
                total={result.data.total}
                onPageChange={setPage}
              />
            </>
          )}
        </>
      )}
      {reserveDialog}
    </section>
  );
}

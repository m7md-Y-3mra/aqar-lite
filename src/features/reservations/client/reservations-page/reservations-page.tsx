"use client";

import Link from "next/link";

import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { PaginationNav } from "@/shared/components/pagination-nav";
import { TableSkeleton } from "@/shared/components/table-skeleton";
import { buttonVariants } from "@/shared/components/ui/button";
import { ReservationsTable } from "./components/reservations-table";
import type { ReservationsPageProps } from "./types";
import { useReservationsPage } from "./use-reservations-page";

export function ReservationsPage({ role }: ReservationsPageProps) {
  const { query, valid, result, setPage } = useReservationsPage();

  return (
    <section className="min-w-0 space-y-6">
      <h1 className="text-2xl font-semibold">الحجوزات</h1>
      {!valid ? (
        <ErrorState message="معايير البحث غير صحيحة. حاول مرة أخرى." resetHref="/reservations" />
      ) : result.isPending ? (
        <TableSkeleton columns={role === "MANAGER" ? 5 : 4} />
      ) : result.isError ? (
        <ErrorState
          message="تعذر تحميل الحجوزات. حاول مرة أخرى."
          onRetry={() => void result.refetch()}
        />
      ) : (
        <>
          {result.data.items.length === 0 ? (
            <EmptyState
              message="لا توجد حجوزات نشطة"
              action={
                <Link href="/units" className={buttonVariants({ variant: "link" })}>
                  عرض الوحدات
                </Link>
              }
            />
          ) : (
            <ReservationsTable
              reservations={result.data.items}
              asOf={result.data.asOf}
              showRep={role === "MANAGER"}
              dimmed={result.isFetching && result.isPlaceholderData}
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
    </section>
  );
}

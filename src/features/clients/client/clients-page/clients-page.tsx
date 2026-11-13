"use client";

import Link from "next/link";

import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { PaginationNav } from "@/shared/components/pagination-nav";
import { TableSkeleton } from "@/shared/components/table-skeleton";
import { buttonVariants } from "@/shared/components/ui/button";
import { ClientsTable } from "./components/clients-table";
import type { ClientsPageProps } from "./types";
import { useClientsPage } from "./use-clients-page";

export function ClientsPage({ role }: ClientsPageProps) {
  const { query, valid, result, setPage } = useClientsPage();

  return (
    <section className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">العملاء</h1>
        {role === "SALES" && (
          <Link href="/clients/new" className={buttonVariants()}>
            إضافة عميل
          </Link>
        )}
      </div>
      {!valid ? (
        <ErrorState
          message="معايير البحث غير صحيحة. امسح الفلاتر وحاول مرة أخرى."
          resetHref="/clients"
        />
      ) : result.isPending ? (
        <TableSkeleton columns={role === "SALES" ? 2 : 3} />
      ) : result.isError ? (
        <ErrorState
          message="تعذر تحميل العملاء. حاول مرة أخرى."
          onRetry={() => void result.refetch()}
        />
      ) : (
        <>
          {result.data.items.length === 0 ? (
            <EmptyState message="لا يوجد عملاء" />
          ) : (
            <ClientsTable
              clients={result.data.items}
              showOwner={role !== "SALES"}
              dimmed={result.isPlaceholderData}
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

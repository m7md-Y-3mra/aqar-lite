"use client";

import Link from "next/link";

import { DetailGrid } from "@/shared/components/detail-grid";
import { ErrorState } from "@/shared/components/error-state";
import { PageHeader } from "@/shared/components/page-header";
import { PageLoading } from "@/shared/components/page-loading";
import { buttonVariants } from "@/shared/components/ui/button";
import type { ClientDetailsProps } from "./types";
import { useClientDetails } from "./use-client-details";

export function ClientDetails({ id, role }: ClientDetailsProps) {
  const detail = useClientDetails(id);
  if (detail.isPending) return <PageLoading />;
  if (detail.isError)
    return <ErrorState message="تعذر تحميل العميل." onRetry={() => void detail.refetch()} />;
  const client = detail.data;

  return (
    <section className="max-w-3xl space-y-6">
      <PageHeader
        title={client.name}
        actions={
          role === "SALES" && (
            <Link href={`/clients/${client.id}/edit`} className={buttonVariants()}>
              تعديل
            </Link>
          )
        }
      />
      <DetailGrid>
        <div>
          <dt>الهاتف</dt>
          <dd>
            <span dir="ltr">{client.phone}</span>
          </dd>
        </div>
        {role !== "SALES" && (
          <div>
            <dt>المندوب</dt>
            <dd>{client.salesRep.name}</dd>
          </div>
        )}
      </DetailGrid>
      <div className="space-y-2 rounded-xl border bg-card p-5 shadow-xs">
        <h2 className="font-semibold">الملاحظات</h2>
        {client.notes ? (
          <p className="whitespace-pre-wrap">{client.notes}</p>
        ) : (
          <p className="text-sm text-muted-foreground">لا توجد ملاحظات</p>
        )}
      </div>
    </section>
  );
}

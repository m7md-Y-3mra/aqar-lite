"use client";

import Link from "next/link";

import { ErrorState } from "@/shared/components/error-state";
import { buttonVariants } from "@/shared/components/ui/button";
import type { ClientDetailsProps } from "./types";
import { useClientDetails } from "./use-client-details";

export function ClientDetails({ id, role }: ClientDetailsProps) {
  const detail = useClientDetails(id);
  if (detail.isPending)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        جارٍ التحميل…
      </p>
    );
  if (detail.isError)
    return <ErrorState message="تعذر تحميل العميل." onRetry={() => void detail.refetch()} />;
  const client = detail.data;

  return (
    <section className="max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{client.name}</h1>
        {role === "SALES" && (
          <Link href={`/clients/${client.id}/edit`} className={buttonVariants()}>
            تعديل
          </Link>
        )}
      </div>
      <p>
        الهاتف: <span dir="ltr">{client.phone}</span>
      </p>
      {role !== "SALES" && <p>المندوب: {client.salesRep.name}</p>}
      <div className="space-y-2">
        <h2 className="font-semibold">الملاحظات</h2>
        {client.notes ? (
          <p className="whitespace-pre-wrap">{client.notes}</p>
        ) : (
          <p>لا توجد ملاحظات</p>
        )}
      </div>
    </section>
  );
}

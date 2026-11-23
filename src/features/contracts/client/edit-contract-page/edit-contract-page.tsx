"use client";

import Link from "next/link";

import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { PageHeader } from "@/shared/components/page-header";
import { PageLoading } from "@/shared/components/page-loading";
import { ApiError } from "@/shared/lib/api-client";
import { ContractForm } from "../contract-form";
import type { EditContractPageProps } from "./types";
import { useEditContractPage } from "./use-edit-contract-page";

export function EditContractPage({ id, userId, relatedQueryKeys }: EditContractPageProps) {
  const query = useEditContractPage(id);
  let body;
  if (query.isPending) {
    body = <PageLoading />;
  } else if (query.isError) {
    body = query.error instanceof ApiError && query.error.status === 404
      ? <EmptyState message="العقد غير موجود" />
      : <ErrorState message="تعذر تحميل العقد." onRetry={() => void query.refetch()} />;
  } else if (query.data.salesRep.id !== userId) {
    body = <EmptyState message="العقد غير موجود" />;
  } else if (query.data.status !== "DRAFT" || query.data.reservationExpired) {
    body = <p>{query.data.status !== "DRAFT" ? "تم اعتماد هذا العقد ولا يمكن تعديله" : "انتهت مدة الحجز، لا يمكن تعديل العقد"}. <Link className="underline" href={`/contracts/${id}`}>عرض العقد</Link></p>;
  } else {
    body = <div className="rounded-xl border bg-card p-5 shadow-xs md:p-6"><ContractForm key={`${query.data.finalPrice}-${query.data.downPayment}-${query.data.installmentCount}`} mode="edit" contract={query.data} relatedQueryKeys={relatedQueryKeys} /></div>;
  }
  return <section className="max-w-4xl space-y-6"><PageHeader title="تعديل العقد" />{body}</section>;
}

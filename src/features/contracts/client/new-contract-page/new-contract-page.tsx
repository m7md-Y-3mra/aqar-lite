"use client";

import Link from "next/link";

import { DetailGrid } from "@/shared/components/detail-grid";
import { ErrorState } from "@/shared/components/error-state";
import { PageHeader } from "@/shared/components/page-header";
import { PageLoading } from "@/shared/components/page-loading";
import { formatRiyadhDateTime } from "@/shared/lib/dates";
import { formatRiyals } from "@/shared/lib/money";
import { ContractForm } from "../contract-form";
import type { NewContractPageProps } from "./types";
import { useNewContractPage } from "./use-new-contract-page";

export function NewContractPage({ reservationId, relatedQueryKeys }: NewContractPageProps) {
  const { query, expired, expiryChecked } = useNewContractPage(reservationId);
  let body;
  if (query.isPending || (query.isSuccess && !expiryChecked)) {
    body = <PageLoading />;
  } else if (query.isError) {
    body = <ErrorState message="تعذر تحميل بيانات الحجز." onRetry={() => void query.refetch()} />;
  } else if (query.data.contractId) {
    body = <p>يوجد عقد لهذا الحجز بالفعل. <Link className="underline" href={`/contracts/${query.data.contractId}`}>عرض العقد</Link></p>;
  } else if (expired) {
    body = <p>انتهت مدة الحجز، لا يمكن إنشاء العقد. <Link className="underline" href="/reservations">العودة إلى الحجوزات</Link></p>;
  } else {
    const data = query.data;
    body = <div className="space-y-6">
      <DetailGrid>
        <div><dt>الوحدة</dt><dd>{data.unit.projectName} — {data.unit.number}</dd></div>
        <div><dt>سعر الوحدة</dt><dd>{formatRiyals(data.unit.price)} ريال</dd></div>
        <div><dt>العميل</dt><dd>{data.client.name}</dd></div>
        <div><dt>انتهاء الحجز</dt><dd>{formatRiyadhDateTime(data.reservation.expiresAt)}</dd></div>
      </DetailGrid>
      <div className="rounded-xl border bg-card p-5 shadow-xs md:p-6"><ContractForm mode="create" reservationId={reservationId} unitPrice={data.unit.price} today={data.today} relatedQueryKeys={relatedQueryKeys} /></div>
    </div>;
  }
  return <section className="max-w-4xl space-y-6"><PageHeader title="إنشاء عقد" />{body}</section>;
}

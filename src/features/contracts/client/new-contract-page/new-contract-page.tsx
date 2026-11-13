"use client";

import Link from "next/link";

import { ErrorState } from "@/shared/components/error-state";
import { formatRiyadhDateTime } from "@/shared/lib/dates";
import { formatRiyals } from "@/shared/lib/money";
import { ContractForm } from "../contract-form";
import type { NewContractPageProps } from "./types";
import { useNewContractPage } from "./use-new-contract-page";

export function NewContractPage({ reservationId, relatedQueryKeys }: NewContractPageProps) {
  const { query, expired, expiryChecked } = useNewContractPage(reservationId);
  let body;
  if (query.isPending || (query.isSuccess && !expiryChecked)) {
    body = <p role="status">جارٍ التحميل…</p>;
  } else if (query.isError) {
    body = <ErrorState message="تعذر تحميل بيانات الحجز." onRetry={() => void query.refetch()} />;
  } else if (query.data.contractId) {
    body = <p>يوجد عقد لهذا الحجز بالفعل. <Link className="underline" href={`/contracts/${query.data.contractId}`}>عرض العقد</Link></p>;
  } else if (expired) {
    body = <p>انتهت مدة الحجز، لا يمكن إنشاء العقد. <Link className="underline" href="/reservations">العودة إلى الحجوزات</Link></p>;
  } else {
    const data = query.data;
    body = <div className="space-y-6">
      <dl className="grid gap-3 sm:grid-cols-2">
        <div><dt className="text-muted-foreground">الوحدة</dt><dd>{data.unit.projectName} — {data.unit.number}</dd></div>
        <div><dt className="text-muted-foreground">سعر الوحدة</dt><dd>{formatRiyals(data.unit.price)} ريال</dd></div>
        <div><dt className="text-muted-foreground">العميل</dt><dd>{data.client.name}</dd></div>
        <div><dt className="text-muted-foreground">انتهاء الحجز</dt><dd>{formatRiyadhDateTime(data.reservation.expiresAt)}</dd></div>
      </dl>
      <ContractForm mode="create" reservationId={reservationId} unitPrice={data.unit.price} today={data.today} relatedQueryKeys={relatedQueryKeys} />
    </div>;
  }
  return <section className="space-y-6"><h1 className="text-2xl font-semibold">إنشاء عقد</h1>{body}</section>;
}

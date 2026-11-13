import Link from "next/link";

import { formatRiyadhDate } from "@/shared/lib/dates";
import { formatRiyals } from "@/shared/lib/money";
import type { AuditEventDetailsProps } from "./types";

export function AuditEventDetails({ event }: AuditEventDetailsProps) {
  if (event.details === null) return <>—</>;

  switch (event.action) {
    case "LOGIN_FAILED":
      return (
        <>{event.details.reason === "locked" ? "الحساب مقفل مؤقتاً" : "بيانات دخول غير صحيحة"}</>
      );
    case "PRICE_CHANGED":
      return (
        <div className="space-y-1">
          <p>
            السعر من {formatRiyals(event.details.oldPrice)} ريال إلى{" "}
            {formatRiyals(event.details.newPrice)} ريال
          </p>
          <Link
            className="text-primary underline underline-offset-4"
            href={`/units/${event.details.unitId}/edit`}
          >
            عرض الوحدة
          </Link>
        </div>
      );
    case "CONTRACT_APPROVED":
      return (
        <div className="space-y-1">
          <p>سعر الوحدة: {formatRiyals(event.details.unitPrice)} ريال</p>
          <p>السعر النهائي: {formatRiyals(event.details.finalPrice)} ريال</p>
          <p>الدفعة المقدمة: {formatRiyals(event.details.downPayment)} ريال</p>
          <p>عدد الأقساط: {event.details.installmentCount}</p>
          <p>
            تاريخ البدء: <span dir="ltr">{formatRiyadhDate(event.details.startDate)}</span>
          </p>
          <Link
            className="text-primary underline underline-offset-4"
            href={`/contracts/${event.details.contractId}`}
          >
            عرض العقد
          </Link>
        </div>
      );
    case "PAYMENT_RECORDED":
      return (
        <div className="space-y-1">
          <p>المبلغ: {formatRiyals(event.details.amount)} ريال</p>
          <ul className="space-y-1">
            {event.details.allocation.map((allocation) => (
              <li key={allocation.seq}>
                {allocation.seq === 0 ? "الدفعة المقدمة" : `القسط ${allocation.seq}`}:{" "}
                {formatRiyals(allocation.applied)} ريال
              </li>
            ))}
          </ul>
          <p>المتبقي بعد الدفعة: {formatRiyals(event.details.remainingAfter)} ريال</p>
          <Link
            className="text-primary underline underline-offset-4"
            href={`/contracts/${event.details.contractId}`}
          >
            عرض العقد
          </Link>
        </div>
      );
  }
}

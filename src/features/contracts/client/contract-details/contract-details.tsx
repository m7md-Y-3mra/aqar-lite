"use client";

import Link from "next/link";

import { ErrorState } from "@/shared/components/error-state";
import { ScheduleTable } from "@/shared/components/schedule-table";
import { Badge } from "@/shared/components/ui/badge";
import { buttonVariants } from "@/shared/components/ui/button";
import { ApiError } from "@/shared/lib/api-client";
import { formatRiyadhDate, formatRiyadhDateTime } from "@/shared/lib/dates";
import { formatRiyals } from "@/shared/lib/money";
import {
  contractStatusLabels,
  ESTIMATED_DATES_LABEL,
  installmentStatusLabels,
} from "../contract-labels";
import { ApproveContractButton } from "./components/approve-contract-button";
import type { ContractDetailsProps } from "./types";
import { useContractDetails } from "./use-contract-details";

export function ContractDetails({ id, role, userId, relatedQueryKeys }: ContractDetailsProps) {
  const detail = useContractDetails(id);
  if (detail.isPending) return <p role="status">جارٍ التحميل…</p>;
  if (detail.isError) {
    if (detail.error instanceof ApiError && detail.error.status === 404) {
      return (
        <section className="space-y-3">
          <h1 className="text-2xl font-semibold">العقد غير موجود</h1>
          <Link href="/contracts">العودة إلى العقود</Link>
        </section>
      );
    }
    return <ErrorState message="تعذر تحميل العقد." onRetry={() => void detail.refetch()} />;
  }
  const contract = detail.data;
  const activeDraft = contract.status === "DRAFT" && !contract.reservationExpired;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">تفاصيل العقد</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary">
            {contract.reservationExpired ? "انتهى الحجز" : contractStatusLabels[contract.status]}
          </Badge>
          {role === "SALES" && contract.salesRep.id === userId && activeDraft && (
            <Link href={`/contracts/${id}/edit`} className={buttonVariants({ variant: "outline" })}>
              تعديل
            </Link>
          )}
        </div>
      </div>
      {role === "ACCOUNTANT" && (
        <ApproveContractButton
          id={id}
          canApprove={activeDraft}
          terms={{
            finalPrice: contract.finalPrice,
            downPayment: contract.downPayment,
            installmentCount: contract.installmentCount,
          }}
          relatedQueryKeys={relatedQueryKeys}
        />
      )}
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">المشروع</dt>
          <dd>{contract.unit.projectName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">الوحدة</dt>
          <dd>{contract.unit.number}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">العميل</dt>
          <dd>{contract.client.name}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">المندوب</dt>
          <dd>{contract.salesRep.name}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">انتهاء الحجز</dt>
          <dd>{formatRiyadhDateTime(contract.reservation.expiresAt)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">سعر الوحدة</dt>
          <dd>{formatRiyals(contract.unit.price)} ريال</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">السعر النهائي</dt>
          <dd>{formatRiyals(contract.finalPrice)} ريال</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">الدفعة المقدمة</dt>
          <dd>{formatRiyals(contract.downPayment)} ريال</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">عدد الأقساط</dt>
          <dd>{contract.installmentCount}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">تاريخ الاعتماد</dt>
          <dd>
            {contract.approvedAt ? formatRiyadhDateTime(contract.approvedAt) : "لم يُعتمد بعد"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">بداية العقد</dt>
          <dd>{contract.startDate ? formatRiyadhDate(contract.startDate) : "لم تُثبّت بعد"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">المتبقي</dt>
          <dd>{formatRiyals(contract.remaining)} ريال</dd>
        </div>
      </dl>
      <div className="space-y-3">
        <h2 className="text-xl font-semibold">جدول الأقساط</h2>
        <ScheduleTable
          lines={contract.schedule.lines}
          estimatedLabel={contract.schedule.estimated ? ESTIMATED_DATES_LABEL : undefined}
          statusLabels={installmentStatusLabels}
        />
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";

import { DetailGrid } from "@/shared/components/detail-grid";
import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { PageHeader } from "@/shared/components/page-header";
import { PageLoading } from "@/shared/components/page-loading";
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

export function ContractDetails({
  id,
  role,
  userId,
  relatedQueryKeys,
  paymentsSlot,
}: ContractDetailsProps) {
  const detail = useContractDetails(id);
  if (detail.isPending) return <PageLoading />;
  if (detail.isError) {
    if (detail.error instanceof ApiError && detail.error.status === 404) {
      return (
        <section className="space-y-6">
          <PageHeader title="العقد غير موجود" />
          <EmptyState
            message="لم نجد هذا العقد في شركتك."
            action={
              <Link href="/contracts" className={buttonVariants({ variant: "link" })}>
                العودة إلى العقود
              </Link>
            }
          />
        </section>
      );
    }
    return <ErrorState message="تعذر تحميل العقد." onRetry={() => void detail.refetch()} />;
  }
  const contract = detail.data;
  const activeDraft = contract.status === "DRAFT" && !contract.reservationExpired;

  return (
    <section className="space-y-6">
      <PageHeader
        title="تفاصيل العقد"
        description={`${contract.unit.projectName} — ${contract.client.name}`}
        actions={
          <>
            <Badge variant="secondary">
              {contract.reservationExpired ? "انتهى الحجز" : contractStatusLabels[contract.status]}
            </Badge>
            {role === "SALES" && contract.salesRep.id === userId && activeDraft && (
              <Link
                href={`/contracts/${id}/edit`}
                className={buttonVariants({ variant: "outline" })}
              >
                تعديل
              </Link>
            )}
          </>
        }
      />
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
      <DetailGrid>
        <div>
          <dt>المشروع</dt>
          <dd>{contract.unit.projectName}</dd>
        </div>
        <div>
          <dt>الوحدة</dt>
          <dd>{contract.unit.number}</dd>
        </div>
        <div>
          <dt>العميل</dt>
          <dd>{contract.client.name}</dd>
        </div>
        <div>
          <dt>المندوب</dt>
          <dd>{contract.salesRep.name}</dd>
        </div>
        <div>
          <dt>انتهاء الحجز</dt>
          <dd>{formatRiyadhDateTime(contract.reservation.expiresAt)}</dd>
        </div>
        <div>
          <dt>سعر الوحدة</dt>
          <dd>{formatRiyals(contract.unit.price)} ريال</dd>
        </div>
        <div>
          <dt>السعر النهائي</dt>
          <dd>{formatRiyals(contract.finalPrice)} ريال</dd>
        </div>
        <div>
          <dt>الدفعة المقدمة</dt>
          <dd>{formatRiyals(contract.downPayment)} ريال</dd>
        </div>
        <div>
          <dt>عدد الأقساط</dt>
          <dd>{contract.installmentCount}</dd>
        </div>
        <div>
          <dt>تاريخ الاعتماد</dt>
          <dd>
            {contract.approvedAt ? formatRiyadhDateTime(contract.approvedAt) : "لم يُعتمد بعد"}
          </dd>
        </div>
        <div>
          <dt>بداية العقد</dt>
          <dd>{contract.startDate ? formatRiyadhDate(contract.startDate) : "لم تُثبّت بعد"}</dd>
        </div>
        <div>
          <dt>المتبقي</dt>
          <dd>{formatRiyals(contract.remaining)} ريال</dd>
        </div>
      </DetailGrid>
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">جدول الأقساط</h2>
        <ScheduleTable
          lines={contract.schedule.lines}
          estimatedLabel={contract.schedule.estimated ? ESTIMATED_DATES_LABEL : undefined}
          statusLabels={installmentStatusLabels}
        />
      </div>
      {contract.status === "APPROVED" && paymentsSlot}
    </section>
  );
}

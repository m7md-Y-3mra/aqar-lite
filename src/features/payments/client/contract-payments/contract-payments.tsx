"use client";

import { useQuery } from "@tanstack/react-query";

import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { TableSkeleton } from "@/shared/components/table-skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { formatRiyadhDateTime } from "@/shared/lib/dates";
import { formatRiyals } from "@/shared/lib/money";
import { contractPaymentsOptions } from "../payments.queries";
import { RecordPaymentForm } from "./components/record-payment-form";
import type { ContractPaymentsProps } from "./types";

export function ContractPayments({ contractId, role, relatedQueryKeys }: ContractPaymentsProps) {
  const query = useQuery(contractPaymentsOptions(contractId));

  return (
    <section className="space-y-3" aria-labelledby="payments-heading">
      <h2 id="payments-heading" className="text-xl font-semibold">
        الدفعات
      </h2>
      {query.isPending ? (
        <TableSkeleton rows={3} columns={2} />
      ) : query.isError ? (
        <ErrorState message="تعذر تحميل الدفعات." onRetry={() => void query.refetch()} />
      ) : (
        <>
          {query.data.remaining === 0 ? (
            <p className="font-medium">تم سداد العقد بالكامل.</p>
          ) : (
            role === "ACCOUNTANT" && (
              <RecordPaymentForm
                contractId={contractId}
                remaining={query.data.remaining}
                relatedQueryKeys={relatedQueryKeys}
              />
            )
          )}
          {query.data.payments.length === 0 ? (
            <EmptyState message="لا توجد دفعات مسجلة بعد" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المبلغ (ريال)</TableHead>
                    <TableHead>تاريخ الدفع</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {query.data.payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell dir="ltr" className="text-end">
                        {formatRiyals(payment.amount)}
                      </TableCell>
                      <TableCell>{formatRiyadhDateTime(payment.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </section>
  );
}

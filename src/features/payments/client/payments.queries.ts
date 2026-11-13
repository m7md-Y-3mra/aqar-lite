import { queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/shared/lib/api-client";
import { paymentKeys } from "../payments.keys";
import type { ContractPaymentsDto, PaymentDto } from "../payments.types";

export function contractPaymentsOptions(contractId: string) {
  return queryOptions({
    queryKey: paymentKeys.list(contractId),
    queryFn: () => apiFetch<ContractPaymentsDto>(`/api/contracts/${contractId}/payments`),
  });
}

/** The same key is sent again on a retry, so the server returns the first payment. */
export function recordPayment(contractId: string, amount: number, idempotencyKey: string) {
  return apiFetch<PaymentDto>(`/api/contracts/${contractId}/payments`, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ amount }),
  });
}

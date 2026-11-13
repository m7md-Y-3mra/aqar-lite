import type { z } from "zod";

import type { recordPaymentInputSchema } from "./payments.schemas";

export type RecordPaymentInput = z.infer<typeof recordPaymentInputSchema>;

export type PaymentDto = {
  id: string;
  amount: number;
  createdAt: string;
};

export type ContractPaymentsDto = {
  approved: boolean;
  remaining: number;
  payments: PaymentDto[];
};

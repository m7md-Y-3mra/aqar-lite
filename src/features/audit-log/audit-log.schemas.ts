import { z } from "zod";

import { paginationFields } from "@/shared/lib/pagination";

export const AUDIT_ACTIONS = [
  "LOGIN_FAILED",
  "PRICE_CHANGED",
  "CONTRACT_APPROVED",
  "PAYMENT_RECORDED",
] as const;

// The login schema allows at most 254 characters, so a longer stored email is not trusted.
export const MAX_AUDIT_EMAIL_LENGTH = 254;

export const auditLogListQuerySchema = z.object({ ...paginationFields });

const halalas = z.number().int().min(0);

// Each schema describes the meta its writer stores; unknown keys are dropped on parse.
export const loginFailedMetaSchema = z.object({
  email: z.string().min(1).max(MAX_AUDIT_EMAIL_LENGTH),
  reason: z.enum(["invalid_credentials", "locked"]),
});

export const priceChangedMetaSchema = z.object({
  oldPrice: halalas,
  newPrice: halalas,
});

export const contractApprovedMetaSchema = z.object({
  unitPrice: halalas,
  finalPrice: halalas,
  downPayment: halalas,
  installmentCount: z.number().int().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const paymentRecordedMetaSchema = z.object({
  contractId: z.uuid(),
  amount: z.number().int().min(1),
  allocation: z.array(
    z.object({
      seq: z.number().int().min(0),
      applied: z.number().int().min(1),
    }),
  ),
  remainingAfter: halalas,
});

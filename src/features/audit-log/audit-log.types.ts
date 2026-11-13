import type { z } from "zod";

import type { Page } from "@/shared/lib/pagination";
import type {
  AUDIT_ACTIONS,
  auditLogListQuerySchema,
  contractApprovedMetaSchema,
  loginFailedMetaSchema,
  paymentRecordedMetaSchema,
  priceChangedMetaSchema,
} from "./audit-log.schemas";

export type AuditAction = (typeof AUDIT_ACTIONS)[number];
export type AuditLogListQuery = z.infer<typeof auditLogListQuerySchema>;

export type LoginFailedDetails = z.infer<typeof loginFailedMetaSchema>;
export type PriceChangedDetails = z.infer<typeof priceChangedMetaSchema> & { unitId: string };
export type ContractApprovedDetails = z.infer<typeof contractApprovedMetaSchema> & {
  contractId: string;
};
export type PaymentRecordedDetails = z.infer<typeof paymentRecordedMetaSchema>;

type AuditEventBase = {
  id: string;
  createdAt: string;
  // Null for failed logins (the UI shows the typed email) and for a missing or foreign user.
  actorName: string | null;
};

// `details` is null when the stored meta does not match its schema.
export type AuditEventDto = AuditEventBase &
  (
    | { action: "LOGIN_FAILED"; details: LoginFailedDetails | null }
    | { action: "PRICE_CHANGED"; details: PriceChangedDetails | null }
    | { action: "CONTRACT_APPROVED"; details: ContractApprovedDetails | null }
    | { action: "PAYMENT_RECORDED"; details: PaymentRecordedDetails | null }
  );

export type AuditLogPage = Page<AuditEventDto>;

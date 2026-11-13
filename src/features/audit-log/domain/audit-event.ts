import {
  contractApprovedMetaSchema,
  loginFailedMetaSchema,
  paymentRecordedMetaSchema,
  priceChangedMetaSchema,
} from "../audit-log.schemas";
import type { AuditAction, AuditEventDto } from "../audit-log.types";

export type AuditLogRow = {
  id: string;
  action: AuditAction;
  entityId: string | null;
  meta: unknown;
  createdAt: Date;
  actorName: string | null;
};

export function toAuditEvent(row: AuditLogRow): AuditEventDto {
  const base = {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    actorName: row.actorName,
  };
  switch (row.action) {
    case "LOGIN_FAILED": {
      const parsed = loginFailedMetaSchema.safeParse(row.meta);
      return {
        ...base,
        action: row.action,
        actorName: null,
        details: parsed.success ? parsed.data : null,
      };
    }
    case "PRICE_CHANGED": {
      const parsed = priceChangedMetaSchema.safeParse(row.meta);
      return {
        ...base,
        action: row.action,
        details:
          parsed.success && row.entityId !== null ? { unitId: row.entityId, ...parsed.data } : null,
      };
    }
    case "CONTRACT_APPROVED": {
      const parsed = contractApprovedMetaSchema.safeParse(row.meta);
      return {
        ...base,
        action: row.action,
        details:
          parsed.success && row.entityId !== null
            ? { contractId: row.entityId, ...parsed.data }
            : null,
      };
    }
    case "PAYMENT_RECORDED": {
      const parsed = paymentRecordedMetaSchema.safeParse(row.meta);
      return { ...base, action: row.action, details: parsed.success ? parsed.data : null };
    }
  }
}

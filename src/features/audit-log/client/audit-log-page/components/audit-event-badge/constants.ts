import type { AuditAction } from "../../../../audit-log.types";

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  LOGIN_FAILED: "محاولة دخول فاشلة",
  PRICE_CHANGED: "تغيير سعر",
  CONTRACT_APPROVED: "اعتماد عقد",
  PAYMENT_RECORDED: "تسجيل دفعة",
};

export const AUDIT_ACTION_CLASSES: Record<AuditAction, string> = {
  LOGIN_FAILED: "bg-red-100 text-red-800",
  PRICE_CHANGED: "bg-amber-100 text-amber-800",
  CONTRACT_APPROVED: "bg-blue-100 text-blue-800",
  PAYMENT_RECORDED: "bg-green-100 text-green-800",
};

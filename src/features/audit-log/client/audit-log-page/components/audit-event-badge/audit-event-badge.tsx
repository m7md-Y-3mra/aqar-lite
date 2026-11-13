import { Badge } from "@/shared/components/ui/badge";
import { AUDIT_ACTION_CLASSES, AUDIT_ACTION_LABELS } from "./constants";
import type { AuditEventBadgeProps } from "./types";

export function AuditEventBadge({ action }: AuditEventBadgeProps) {
  return <Badge className={AUDIT_ACTION_CLASSES[action]}>{AUDIT_ACTION_LABELS[action]}</Badge>;
}

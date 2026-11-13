import { Badge } from "@/shared/components/ui/badge";
import { UNIT_STATUS_LABELS, UNIT_STATUS_VARIANTS } from "../../../unit-labels";
import type { UnitStatusBadgeProps } from "./types";

export function UnitStatusBadge({ status }: UnitStatusBadgeProps) {
  return <Badge variant={UNIT_STATUS_VARIANTS[status]}>{UNIT_STATUS_LABELS[status]}</Badge>;
}

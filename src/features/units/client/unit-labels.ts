import type { UnitDto } from "../units.types";

export const UNIT_TYPE_LABELS = {
  APARTMENT: "شقة",
  VILLA: "فيلا",
  TOWNHOUSE: "تاون هاوس",
  DUPLEX: "دوبلكس",
} as const satisfies Record<UnitDto["type"], string>;

export const UNIT_STATUS_LABELS = {
  AVAILABLE: "متاحة",
  RESERVED: "محجوزة",
  SOLD: "مباعة",
} as const satisfies Record<UnitDto["status"], string>;

export const UNIT_STATUS_VARIANTS = {
  AVAILABLE: "default",
  RESERVED: "secondary",
  SOLD: "outline",
} as const satisfies Record<UnitDto["status"], "default" | "secondary" | "outline" | "destructive">;

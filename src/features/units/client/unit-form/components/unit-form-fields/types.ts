import type { UnitDto } from "../../../../units.types";

export type UnitFormFieldsProps =
  | { mode: "create" }
  | { mode: "edit"; unit: UnitDto; onConflict: () => Promise<{ data?: UnitDto }> };

import type { UnitDto } from "../../../../units.types";

export type UnitsTableProps = {
  units: UnitDto[];
  canEdit: boolean;
  canReserve: boolean;
  dimmed: boolean;
  onReserve: (unitId: string) => void;
};

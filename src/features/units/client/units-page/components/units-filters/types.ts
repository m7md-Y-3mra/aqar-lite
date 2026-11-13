import type { UnitListQuery } from "../../../../units.types";

export type UnitsFiltersProps = {
  query: UnitListQuery;
  onApply: (next: Partial<UnitListQuery>) => void;
};

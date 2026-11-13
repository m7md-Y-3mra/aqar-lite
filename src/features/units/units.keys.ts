import type { UnitListQuery } from "./units.types";

export const unitKeys = {
  all: ["units"] as const,
  list: (query: UnitListQuery) => [...unitKeys.all, "list", query] as const,
  detail: (id: string) => [...unitKeys.all, "detail", id] as const,
};

import { queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/shared/lib/api-client";
import { unitKeys } from "../units.keys";
import type { UnitDto, UnitListQuery, UnitPage } from "../units.types";

export function unitListOptions(query: UnitListQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }

  return queryOptions({
    queryKey: unitKeys.list(query),
    queryFn: () => apiFetch<UnitPage>(`/api/units?${params.toString()}`),
  });
}

export function unitDetailOptions(id: string) {
  return queryOptions({
    queryKey: unitKeys.detail(id),
    queryFn: () => apiFetch<UnitDto>(`/api/units/${id}`),
  });
}

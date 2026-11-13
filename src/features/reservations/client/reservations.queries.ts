import { keepPreviousData, queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/shared/lib/api-client";
import { reservationKeys } from "../reservations.keys";
import type {
  ReservationDto,
  ReservationListQuery,
  ReservationPage,
  ReserveInput,
  ReserveOptionsDto,
} from "../reservations.types";

export function reservationListOptions(query: ReservationListQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    params.set(key, String(value));
  }

  return queryOptions({
    queryKey: reservationKeys.list(query),
    queryFn: () => apiFetch<ReservationPage>(`/api/reservations?${params.toString()}`),
    placeholderData: keepPreviousData,
  });
}

export function reserveOptionsOptions(unitId: string) {
  return queryOptions({
    queryKey: reservationKeys.options(unitId),
    queryFn: () =>
      apiFetch<ReserveOptionsDto>(`/api/reservations/options?${new URLSearchParams({ unitId })}`),
    staleTime: 0,
  });
}

export function reserveUnit(input: ReserveInput) {
  return apiFetch<ReservationDto>("/api/reservations", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

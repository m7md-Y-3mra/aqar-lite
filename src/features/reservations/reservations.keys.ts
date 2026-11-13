import type { ReservationListQuery } from "./reservations.types";

export const reservationKeys = {
  all: ["reservations"] as const,
  list: (query: ReservationListQuery) => [...reservationKeys.all, "list", query] as const,
  options: (unitId: string) => [...reservationKeys.all, "options", unitId] as const,
};

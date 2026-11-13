import type { ReservationDto } from "../../../../reservations.types";

export type ReservationsTableProps = {
  reservations: ReservationDto[];
  asOf: string;
  showRep: boolean;
  dimmed: boolean;
};

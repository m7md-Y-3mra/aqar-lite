import type { z } from "zod";

import type { Page } from "@/shared/lib/pagination";
import type { reservationListQuerySchema, reserveInputSchema } from "./reservations.schemas";

export type ReserveInput = z.infer<typeof reserveInputSchema>;
export type ReservationListQuery = z.infer<typeof reservationListQuerySchema>;

export type ReservationDto = {
  id: string;
  expiresAt: string;
  unit: { id: string; projectName: string; number: string };
  client: { id: string; name: string };
  salesRep: { id: string; name: string };
};

export type ReservationPage = Page<ReservationDto> & { asOf: string };

export type ReserveOptionsDto = {
  unit: {
    id: string;
    projectName: string;
    number: string;
    status: "AVAILABLE" | "RESERVED" | "SOLD";
  };
  clients: { id: string; name: string }[];
};

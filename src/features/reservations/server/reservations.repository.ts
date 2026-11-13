import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { Tx } from "@/server/db";
import { RESERVATION_HOURS } from "../domain/reservation-window";

const reservationSelect = {
  id: true,
  expiresAt: true,
  unit: { select: { id: true, projectName: true, number: true } },
  client: { select: { id: true, name: true } },
  salesRep: { select: { id: true, name: true } },
} satisfies Prisma.ReservationSelect;

export async function insertReservation(
  companyId: string,
  input: { unitId: string; clientId: string; salesRepId: string },
  tx: Tx,
) {
  const [row] = await tx.$queryRaw<{ id: string }[]>`
    INSERT INTO reservations (company_id, unit_id, client_id, sales_rep_id, expires_at)
    VALUES (
      ${companyId}::uuid, ${input.unitId}::uuid, ${input.clientId}::uuid,
      ${input.salesRepId}::uuid, now() + make_interval(hours => ${RESERVATION_HOURS})
    )
    RETURNING id
  `;
  return row!.id;
}

export function findReservationById(companyId: string, id: string, tx: Tx) {
  return tx.reservation.findFirst({
    where: { id, companyId },
    select: reservationSelect,
  });
}

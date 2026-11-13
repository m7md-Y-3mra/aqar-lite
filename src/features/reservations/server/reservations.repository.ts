import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { Tx } from "@/server/db";
import { RESERVATION_HOURS } from "../domain/reservation-window";

const reservationSelect = {
  id: true,
  expiresAt: true,
  contract: { select: { id: true } },
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

type ActiveFilter = { salesRepId?: string; now: Date };

function activeWhere(companyId: string, { salesRepId, now }: ActiveFilter) {
  return {
    companyId,
    salesRepId,
    expiresAt: { gt: now },
    OR: [{ contract: { is: null } }, { contract: { is: { approvedAt: null } } }],
  } satisfies Prisma.ReservationWhereInput;
}

export function findActiveReservations(
  companyId: string,
  filter: ActiveFilter,
  pagination: { skip: number; take: number },
  tx: Tx,
) {
  return tx.reservation.findMany({
    where: activeWhere(companyId, filter),
    orderBy: [{ expiresAt: "asc" }, { id: "asc" }],
    skip: pagination.skip,
    take: pagination.take,
    select: reservationSelect,
  });
}

export function countActiveReservations(companyId: string, filter: ActiveFilter, tx: Tx) {
  return tx.reservation.count({ where: activeWhere(companyId, filter) });
}

export async function dbNow(tx: Tx): Promise<Date> {
  const [row] = await tx.$queryRaw<{ now: Date }[]>`SELECT now() AS now`;
  return row!.now;
}

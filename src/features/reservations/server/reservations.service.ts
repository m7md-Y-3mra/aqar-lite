import "server-only";

import { getClient, listClients } from "@/features/clients/server";
import {
  findUnitStatus,
  getUnit,
  releaseExpired,
  reserveUnitIfAvailable,
} from "@/features/units/server";
import type { SessionUser } from "@/server/auth/session.service";
import { withTransaction } from "@/server/db";
import { AppError } from "@/server/http/app-error";
import { toSkip } from "@/shared/lib/pagination";
import type {
  ReservationDto,
  ReservationListQuery,
  ReservationPage,
  ReserveInput,
  ReserveOptionsDto,
} from "../reservations.types";
import {
  countActiveReservations,
  dbNow,
  findActiveReservations,
  findReservationById,
  insertReservation,
} from "./reservations.repository";

function toReservationDto(
  row: NonNullable<Awaited<ReturnType<typeof findReservationById>>>,
): ReservationDto {
  return {
    id: row.id,
    expiresAt: row.expiresAt.toISOString(),
    contractId: row.contract?.id ?? null,
    unit: row.unit,
    client: row.client,
    salesRep: row.salesRep,
  };
}

export async function reserveUnit(user: SessionUser, input: ReserveInput): Promise<ReservationDto> {
  if (user.role !== "SALES") throw new AppError("FORBIDDEN");
  await getClient(user, input.clientId);

  return withTransaction(async (tx) => {
    await releaseExpired(user.companyId, tx);
    const count = await reserveUnitIfAvailable(user.companyId, input.unitId, tx);
    if (count === 0) {
      const unit = await findUnitStatus(user.companyId, input.unitId, tx);
      if (unit === null) throw new AppError("NOT_FOUND");
      throw new AppError("UNIT_NOT_AVAILABLE");
    }

    const id = await insertReservation(
      user.companyId,
      { unitId: input.unitId, clientId: input.clientId, salesRepId: user.userId },
      tx,
    );
    const row = await findReservationById(user.companyId, id, tx);
    if (row === null) throw new AppError("NOT_FOUND");
    return toReservationDto(row);
  });
}

export async function getReserveOptions(
  user: SessionUser,
  unitId: string,
): Promise<ReserveOptionsDto> {
  if (user.role !== "SALES") throw new AppError("FORBIDDEN");
  const unit = await getUnit(user, unitId);
  const clients = await listClients(user, { page: 1, pageSize: 50 });
  return {
    unit: {
      id: unit.id,
      projectName: unit.projectName,
      number: unit.number,
      status: unit.status,
    },
    clients: clients.items.map(({ id, name }) => ({ id, name })),
  };
}

export async function listActiveReservations(
  user: SessionUser,
  query: ReservationListQuery,
): Promise<ReservationPage> {
  if (user.role === "ACCOUNTANT") throw new AppError("FORBIDDEN");

  return withTransaction(async (tx) => {
    await releaseExpired(user.companyId, tx);
    const now = await dbNow(tx);
    const salesRepId = user.role === "SALES" ? user.userId : undefined;
    const filter = { salesRepId, now };
    const rows = await findActiveReservations(
      user.companyId,
      filter,
      { skip: toSkip(query.page, query.pageSize), take: query.pageSize },
      tx,
    );
    const total = await countActiveReservations(user.companyId, filter, tx);
    return {
      items: rows.map(toReservationDto),
      total,
      page: query.page,
      pageSize: query.pageSize,
      asOf: now.toISOString(),
    };
  });
}

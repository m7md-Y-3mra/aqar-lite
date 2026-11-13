import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { getDb, withTransaction, type Tx } from "@/server/db";
import { toSkip } from "@/shared/lib/pagination";
import type { UnitInput, UnitListQuery } from "../units.types";

function unitWhere(companyId: string, query: UnitListQuery): Prisma.UnitWhereInput {
  return {
    companyId,
    status: query.status,
    price: {
      gte: query.minPrice === undefined ? undefined : BigInt(query.minPrice),
      lte: query.maxPrice === undefined ? undefined : BigInt(query.maxPrice),
    },
  };
}

// Lock candidates first: a waiting statement's NOT EXISTS keeps its old snapshot.
// The second statement sees newly committed reservations under READ COMMITTED.
// Call before locking any unit row; never call inside another service's transaction.
export function releaseExpired(companyId: string, tx?: Tx) {
  const run = async (db: Tx) => {
    const rows = await db.$queryRaw<{ id: string }[]>`
      SELECT u.id FROM units u
      WHERE u.company_id = ${companyId} AND u.status = 'RESERVED'
        AND NOT EXISTS (
          SELECT 1 FROM reservations r WHERE r.unit_id = u.id AND r.expires_at > now()
        )
      ORDER BY u.id FOR UPDATE
    `;
    if (rows.length === 0) return 0;
    const ids = rows.map((row) => row.id);
    return db.$executeRaw`
      UPDATE units u SET status = 'AVAILABLE'
      WHERE u.id = ANY(${ids}::uuid[]) AND u.company_id = ${companyId}
        AND u.status = 'RESERVED'
        AND NOT EXISTS (
          SELECT 1 FROM reservations r WHERE r.unit_id = u.id AND r.expires_at > now()
        )
    `;
  };
  return tx ? run(tx) : withTransaction(run);
}

export function findUnits(companyId: string, query: UnitListQuery, tx?: Tx) {
  const db = tx ?? getDb();
  const orderBy: Prisma.UnitOrderByWithRelationInput[] = query.sort
    ? [{ [query.sort]: query.order }, { id: "asc" }]
    : [{ projectName: "asc" }, { number: "asc" }, { id: "asc" }];

  return db.unit.findMany({
    where: unitWhere(companyId, query),
    orderBy,
    skip: toSkip(query.page, query.pageSize),
    take: query.pageSize,
  });
}

export function countUnits(companyId: string, query: UnitListQuery, tx?: Tx) {
  const db = tx ?? getDb();
  return db.unit.count({ where: unitWhere(companyId, query) });
}

export function findUnit(companyId: string, id: string, tx?: Tx) {
  const db = tx ?? getDb();
  return db.unit.findFirst({ where: { id, companyId } });
}

export function insertUnit(companyId: string, input: UnitInput, tx?: Tx) {
  const db = tx ?? getDb();
  return db.unit.create({
    data: {
      companyId,
      projectName: input.projectName,
      number: input.number,
      type: input.type,
      area: input.area,
      rooms: input.rooms,
      price: BigInt(input.price),
    },
  });
}

export async function updateUnitDetails(
  companyId: string,
  id: string,
  fields: Pick<UnitInput, "projectName" | "number" | "type" | "area" | "rooms">,
  tx?: Tx,
) {
  const db = tx ?? getDb();
  const result = await db.unit.updateMany({
    where: { id, companyId },
    data: {
      projectName: fields.projectName,
      number: fields.number,
      type: fields.type,
      area: fields.area,
      rooms: fields.rooms,
    },
  });
  return result.count;
}

export async function updateUnitPriceIfAvailable(
  companyId: string,
  id: string,
  input: UnitInput,
  oldPrice: bigint,
  tx?: Tx,
) {
  const db = tx ?? getDb();
  const result = await db.unit.updateMany({
    where: { id, companyId, status: "AVAILABLE", price: oldPrice },
    data: {
      projectName: input.projectName,
      number: input.number,
      type: input.type,
      area: input.area,
      rooms: input.rooms,
      price: BigInt(input.price),
    },
  });
  return result.count;
}

export async function reserveUnitIfAvailable(companyId: string, unitId: string, tx: Tx) {
  const result = await tx.unit.updateMany({
    where: { id: unitId, companyId, status: "AVAILABLE" },
    data: { status: "RESERVED" },
  });
  return result.count;
}

export async function lockUnit(companyId: string, unitId: string, tx: Tx) {
  const [row] = await tx.$queryRaw<{ status: "AVAILABLE" | "RESERVED" | "SOLD" }[]>`
    SELECT status FROM units
    WHERE id = ${unitId}::uuid AND company_id = ${companyId}::uuid
    FOR UPDATE
  `;
  return row?.status ?? null;
}

export async function markUnitSold(companyId: string, unitId: string, tx: Tx) {
  const result = await tx.unit.updateMany({
    where: { id: unitId, companyId, status: "RESERVED" },
    data: { status: "SOLD" },
  });
  return result.count;
}

export function findUnitStatus(companyId: string, unitId: string, tx: Tx) {
  return tx.unit.findFirst({ where: { id: unitId, companyId }, select: { status: true } });
}

export async function dbNow(tx?: Tx): Promise<Date> {
  const db = tx ?? getDb();
  const [row] = await db.$queryRaw<{ now: Date }[]>`SELECT now() AS now`;
  return row!.now;
}

export function findActiveExpiries(companyId: string, unitIds: string[], now: Date, tx?: Tx) {
  if (unitIds.length === 0) return Promise.resolve([]);
  const db = tx ?? getDb();
  return db.reservation.findMany({
    where: { companyId, unitId: { in: unitIds }, expiresAt: { gt: now } },
    select: { unitId: true, expiresAt: true },
  });
}

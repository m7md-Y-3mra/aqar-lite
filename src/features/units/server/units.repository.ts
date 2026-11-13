import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { getDb, type Tx } from "@/server/db";
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

export function releaseExpired(companyId: string, tx?: Tx) {
  const db = tx ?? getDb();
  return db.$executeRaw`
    UPDATE units u SET status = 'AVAILABLE'
    WHERE u.company_id = ${companyId} AND u.status = 'RESERVED'
      AND NOT EXISTS (
        SELECT 1 FROM reservations r WHERE r.unit_id = u.id AND r.expires_at > now()
      )
  `;
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

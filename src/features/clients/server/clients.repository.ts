import "server-only";

import { getDb, type Tx } from "@/server/db";
import { toSkip } from "@/shared/lib/pagination";
import type { ClientInput } from "../clients.types";

type ClientScope = { salesRepId?: string };

const clientInclude = {
  salesRep: { select: { id: true, name: true } },
} as const;

export function findClients(
  companyId: string,
  scope: ClientScope,
  page: number,
  pageSize: number,
  tx?: Tx,
) {
  const db = tx ?? getDb();
  return db.client.findMany({
    where: { companyId, salesRepId: scope.salesRepId },
    include: clientInclude,
    orderBy: [{ name: "asc" }, { id: "asc" }],
    skip: toSkip(page, pageSize),
    take: pageSize,
  });
}

export function countClients(companyId: string, scope: ClientScope, tx?: Tx) {
  const db = tx ?? getDb();
  return db.client.count({ where: { companyId, salesRepId: scope.salesRepId } });
}

export function findClient(companyId: string, id: string, salesRepId?: string, tx?: Tx) {
  const db = tx ?? getDb();
  return db.client.findFirst({
    where: { id, companyId, salesRepId },
    include: clientInclude,
  });
}

export function insertClient(companyId: string, salesRepId: string, input: ClientInput, tx?: Tx) {
  const db = tx ?? getDb();
  return db.client.create({
    data: {
      companyId,
      salesRepId,
      name: input.name,
      phone: input.phone,
      notes: input.notes,
    },
    include: clientInclude,
  });
}

export async function updateOwnClient(
  companyId: string,
  id: string,
  salesRepId: string,
  input: ClientInput,
  tx?: Tx,
) {
  const db = tx ?? getDb();
  const result = await db.client.updateMany({
    where: { id, companyId, salesRepId },
    data: { name: input.name, phone: input.phone, notes: input.notes },
  });
  return result.count;
}

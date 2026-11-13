import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { getDb, type Tx } from "@/server/db";
import { AppError } from "@/server/http/app-error";
import type { ScheduleLine, ScheduleTerms } from "../domain/schedule";

const reservationSelect = {
  id: true,
  expiresAt: true,
  unit: { select: { id: true, projectName: true, number: true, price: true } },
  client: { select: { id: true, name: true } },
  salesRep: { select: { id: true, name: true } },
} satisfies Prisma.ReservationSelect;

type ContractFilter = { salesRepId?: string };
type ContractPagination = ContractFilter & { skip: number; take: number };

function contractWhere(companyId: string, filter: ContractFilter): Prisma.ContractWhereInput {
  return {
    companyId,
    reservation: filter.salesRepId ? { salesRepId: filter.salesRepId } : undefined,
  };
}

export async function dbNow(tx?: Tx): Promise<Date> {
  const [row] = await (tx ?? getDb()).$queryRaw<{ now: Date }[]>`SELECT now() AS now`;
  return row!.now;
}

export async function dbClock(tx: Tx): Promise<Date> {
  const [row] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
  return row!.now;
}

export function findOwnReservation(
  companyId: string,
  salesRepId: string,
  reservationId: string,
  tx?: Tx,
) {
  return (tx ?? getDb()).reservation.findFirst({
    where: { id: reservationId, companyId, salesRepId },
    select: { ...reservationSelect, contract: { select: { id: true } } },
  });
}

export function insertContract(
  companyId: string,
  input: ScheduleTerms & { reservationId: string },
  tx: Tx,
) {
  return tx.contract.create({
    data: {
      companyId,
      reservationId: input.reservationId,
      finalPrice: BigInt(input.finalPrice),
      downPayment: BigInt(input.downPayment),
      installmentCount: input.installmentCount,
    },
  });
}

export function findContract(
  companyId: string,
  id: string,
  filter: ContractFilter = {},
  tx?: Tx,
) {
  return (tx ?? getDb()).contract.findFirst({
    where: { ...contractWhere(companyId, filter), id },
    include: {
      reservation: { select: reservationSelect },
      installments: { orderBy: { seq: "asc" } },
    },
  });
}

export function findContracts(companyId: string, filter: ContractPagination, tx?: Tx) {
  return (tx ?? getDb()).contract.findMany({
    where: contractWhere(companyId, filter),
    include: { reservation: { select: reservationSelect } },
    orderBy: [{ approvedAt: { sort: "desc", nulls: "first" } }, { id: "asc" }],
    skip: filter.skip,
    take: filter.take,
  });
}

export function countContracts(
  companyId: string,
  filter: ContractFilter & { skip?: number; take?: number } = {},
  tx?: Tx,
) {
  return (tx ?? getDb()).contract.count({ where: contractWhere(companyId, filter) });
}

export function sumPaidByContract(companyId: string, contractIds: string[], tx?: Tx) {
  return (tx ?? getDb()).installment.groupBy({
    by: ["contractId"],
    where: { contractId: { in: contractIds }, contract: { companyId } },
    _sum: { paidAmount: true },
  });
}

export async function updateDraftTerms(
  companyId: string,
  id: string,
  terms: ScheduleTerms,
  tx: Tx,
) {
  const result = await tx.contract.updateMany({
    where: { id, companyId, approvedAt: null },
    data: {
      finalPrice: BigInt(terms.finalPrice),
      downPayment: BigInt(terms.downPayment),
      installmentCount: terms.installmentCount,
    },
  });
  return result.count;
}

type LockedContract = {
  id: string;
  reservationId: string;
  finalPrice: bigint;
  downPayment: bigint;
  installmentCount: number;
  approvedAt: Date | null;
  expiresAt: Date;
  unitId: string;
  unitPrice: bigint;
};

export async function lockContract(companyId: string, id: string, tx: Tx) {
  const [row] = await tx.$queryRaw<LockedContract[]>`
    SELECT c.id, c.reservation_id AS "reservationId", c.final_price AS "finalPrice",
      c.down_payment AS "downPayment", c.installment_count AS "installmentCount",
      c.approved_at AS "approvedAt", r.expires_at AS "expiresAt",
      r.unit_id AS "unitId", u.price AS "unitPrice"
    FROM contracts c
    JOIN reservations r ON r.id = c.reservation_id AND r.company_id = c.company_id
    JOIN units u ON u.id = r.unit_id AND u.company_id = c.company_id
    WHERE c.id = ${id}::uuid AND c.company_id = ${companyId}::uuid
    FOR UPDATE OF c
  `;
  return row ?? null;
}

export async function markApproved(companyId: string, id: string, at: Date, tx: Tx) {
  const result = await tx.contract.updateMany({
    where: { id, companyId, approvedAt: null },
    data: { approvedAt: at },
  });
  return result.count;
}

export async function insertInstallments(
  companyId: string,
  contractId: string,
  lines: ScheduleLine[],
  tx: Tx,
) {
  if ((await tx.contract.count({ where: { id: contractId, companyId } })) !== 1) {
    throw new AppError("NOT_FOUND");
  }
  return tx.installment.createMany({
    data: lines.map((line) => ({
      contractId,
      seq: line.seq,
      dueDate: new Date(`${line.dueDate}T00:00:00.000Z`),
      amount: BigInt(line.amount),
    })),
  });
}

// Used by payments (through ./index.ts). Installments have no company_id column, so they are scoped by their contract.

export function findContractTotals(companyId: string, id: string, tx?: Tx) {
  return (tx ?? getDb()).contract.findFirst({
    where: { id, companyId },
    select: { id: true, finalPrice: true, approvedAt: true },
  });
}

export function findOpenInstallments(companyId: string, contractId: string, tx: Tx) {
  return tx.$queryRaw<{ id: string; seq: number; amount: bigint; paidAmount: bigint }[]>`
    SELECT i.id, i.seq, i.amount, i.paid_amount AS "paidAmount"
    FROM installments i
    JOIN contracts c ON c.id = i.contract_id
    WHERE i.contract_id = ${contractId}::uuid AND c.company_id = ${companyId}::uuid
      AND i.paid_amount < i.amount
    ORDER BY i.seq
  `;
}

export async function addInstallmentPaid(
  companyId: string,
  installmentId: string,
  halalas: number,
  tx: Tx,
) {
  const result = await tx.installment.updateMany({
    where: { id: installmentId, contract: { companyId } },
    data: { paidAmount: { increment: BigInt(halalas) } },
  });
  return result.count;
}

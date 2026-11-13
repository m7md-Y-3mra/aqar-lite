import "server-only";

import type { SessionUser } from "@/server/auth/session.service";
import { AppError } from "@/server/http/app-error";
import { toRiyadhDate } from "@/shared/lib/dates";
import { toSkip } from "@/shared/lib/pagination";
import type {
  ContractDetailDto,
  ContractListItemDto,
  ContractListQuery,
  ContractOptionsDto,
  ContractPage,
} from "../contracts.types";
import { contractRemaining, installmentStatus } from "../domain/installment-status";
import { minFinalPrice } from "../domain/pricing";
import { buildSchedule } from "../domain/schedule";
import {
  countContracts,
  dbNow,
  findContract,
  findContracts,
  findOwnReservation,
  sumPaidByContract,
} from "./contracts.repository";

type ContractRow = NonNullable<Awaited<ReturnType<typeof findContract>>>;
type ListRow = Awaited<ReturnType<typeof findContracts>>[number];

function toListItemDto(row: ListRow, now: Date, paidAmount: number): ContractListItemDto {
  const { unit, client, salesRep } = row.reservation;
  return {
    id: row.id,
    status: row.approvedAt === null ? "DRAFT" : "APPROVED",
    reservationExpired: row.approvedAt === null && row.reservation.expiresAt <= now,
    unit: { id: unit.id, projectName: unit.projectName, number: unit.number },
    client: { id: client.id, name: client.name },
    salesRep: { id: salesRep.id, name: salesRep.name },
    finalPrice: Number(row.finalPrice),
    remaining: Number(row.finalPrice) - (row.approvedAt === null ? 0 : paidAmount),
    approvedAt: row.approvedAt?.toISOString() ?? null,
  };
}

function toDetailDto(row: ContractRow, now: Date): ContractDetailDto {
  const today = toRiyadhDate(now);
  const terms = {
    finalPrice: Number(row.finalPrice),
    downPayment: Number(row.downPayment),
    installmentCount: row.installmentCount,
  };
  const storedLines = row.installments.map((line) => {
    const values = {
      seq: line.seq,
      dueDate: line.dueDate.toISOString().slice(0, 10),
      amount: Number(line.amount),
      paidAmount: Number(line.paidAmount),
    };
    return { ...values, status: installmentStatus(values, today) };
  });
  const item = toListItemDto(row, now, 0);
  return {
    ...item,
    unit: { ...item.unit, price: Number(row.reservation.unit.price) },
    reservation: { id: row.reservation.id, expiresAt: row.reservation.expiresAt.toISOString() },
    downPayment: terms.downPayment,
    installmentCount: terms.installmentCount,
    minFinalPrice: minFinalPrice(Number(row.reservation.unit.price)),
    startDate: row.approvedAt === null ? null : toRiyadhDate(row.approvedAt),
    today,
    remaining:
      row.approvedAt === null ? terms.finalPrice : contractRemaining(terms.finalPrice, storedLines),
    schedule:
      row.approvedAt === null
        ? { estimated: true, lines: buildSchedule(terms, today) }
        : { estimated: false, lines: storedLines },
  };
}

export async function getContract(user: SessionUser, id: string): Promise<ContractDetailDto> {
  const row = await findContract(user.companyId, id, {
    salesRepId: user.role === "SALES" ? user.userId : undefined,
  });
  if (row === null) throw new AppError("NOT_FOUND");
  return toDetailDto(row, await dbNow());
}

export async function getContractOptions(
  user: SessionUser,
  reservationId: string,
): Promise<ContractOptionsDto> {
  if (user.role !== "SALES") throw new AppError("FORBIDDEN");
  const row = await findOwnReservation(user.companyId, user.userId, reservationId);
  if (row === null) throw new AppError("NOT_FOUND");
  const now = await dbNow();
  return {
    reservation: { id: row.id, expiresAt: row.expiresAt.toISOString() },
    unit: {
      id: row.unit.id,
      projectName: row.unit.projectName,
      number: row.unit.number,
      price: Number(row.unit.price),
    },
    client: { id: row.client.id, name: row.client.name },
    minFinalPrice: minFinalPrice(Number(row.unit.price)),
    today: toRiyadhDate(now),
    contractId: row.contract?.id ?? null,
  };
}

export async function listContracts(
  user: SessionUser,
  query: ContractListQuery,
): Promise<ContractPage> {
  const filter = {
    salesRepId: user.role === "SALES" ? user.userId : undefined,
    skip: toSkip(query.page, query.pageSize),
    take: query.pageSize,
  };
  const [rows, total, now] = await Promise.all([
    findContracts(user.companyId, filter),
    countContracts(user.companyId, filter),
    dbNow(),
  ]);
  const sums = await sumPaidByContract(
    user.companyId,
    rows.filter((row) => row.approvedAt !== null).map((row) => row.id),
  );
  const paid = new Map(sums.map((row) => [row.contractId, Number(row._sum.paidAmount ?? 0)]));
  return {
    items: rows.map((row) => toListItemDto(row, now, paid.get(row.id) ?? 0)),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

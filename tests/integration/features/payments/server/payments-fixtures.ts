import { randomUUID } from "node:crypto";

import type { SessionUser } from "@/server/auth/session.service";
import { getDb } from "@/server/db";
import {
  makeClient,
  makeContract,
  makeInstallment,
  makeReservation,
  makeUnit,
} from "../../../support/db-fixtures";

// Down payment 50,000 riyals, then three monthly lines of 10,000 riyals (halalas).
export const LINES = [5_000_000, 1_000_000, 1_000_000, 1_000_000];

/**
 * An approved contract with stored schedule lines. With a down payment, `lines[0]` is seq 0;
 * without one, the lines start at seq 1.
 */
export async function makeApprovedContract(
  owner: SessionUser,
  lines: number[] = LINES,
  { withDownPayment = true } = {},
) {
  const unit = await makeUnit(owner.companyId, { status: "SOLD" });
  const client = await makeClient(owner.companyId, owner.userId);
  const reservation = await makeReservation({
    companyId: owner.companyId,
    unitId: unit.id,
    clientId: client.id,
    salesRepId: owner.userId,
  });
  const finalPrice = lines.reduce((sum, amount) => sum + amount, 0);
  const contract = await makeContract(owner.companyId, reservation.id, {
    finalPrice: BigInt(finalPrice),
    downPayment: withDownPayment ? BigInt(lines[0]!) : 0n,
    installmentCount: withDownPayment ? lines.length - 1 : lines.length,
    approvedAt: new Date(),
  });
  for (const [index, amount] of lines.entries()) {
    const seq = withDownPayment ? index : index + 1;
    await makeInstallment(contract.id, {
      seq,
      amount: BigInt(amount),
      dueDate: new Date(Date.UTC(2030, seq, 1)),
    });
  }
  return { id: contract.id, finalPrice };
}

export async function makeDraftContract(owner: SessionUser) {
  const unit = await makeUnit(owner.companyId, { status: "RESERVED" });
  const client = await makeClient(owner.companyId, owner.userId);
  const reservation = await makeReservation({
    companyId: owner.companyId,
    unitId: unit.id,
    clientId: client.id,
    salesRepId: owner.userId,
  });
  return makeContract(owner.companyId, reservation.id);
}

export async function paidBySeq(contractId: string) {
  const rows = await getDb().installment.findMany({
    where: { contractId },
    orderBy: { seq: "asc" },
    select: { paidAmount: true },
  });
  return rows.map((row) => Number(row.paidAmount));
}

export function paymentCount(contractId: string) {
  return getDb().payment.count({ where: { contractId } });
}

export function paymentAudits(contractId: string) {
  return getDb().auditLog.findMany({
    where: { action: "PAYMENT_RECORDED", meta: { path: ["contractId"], equals: contractId } },
  });
}

export const newKey = () => randomUUID();

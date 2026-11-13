import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { getDb, type Tx } from "@/server/db";

// Payments have no company_id column: every query reaches the company through the contract.

const paymentSelect = {
  id: true,
  amount: true,
  createdAt: true,
} satisfies Prisma.PaymentSelect;

export function findPaymentByKey(companyId: string, contractId: string, key: string, tx: Tx) {
  return tx.payment.findFirst({
    where: { contractId, idempotencyKey: key, contract: { companyId } },
    select: paymentSelect,
  });
}

/** Inserts only when the contract belongs to the company; returns null otherwise. */
export async function insertPayment(
  companyId: string,
  input: { contractId: string; amount: number; idempotencyKey: string },
  tx: Tx,
) {
  const [row] = await tx.$queryRaw<{ id: string; amount: bigint; createdAt: Date }[]>`
    INSERT INTO payments (contract_id, amount, idempotency_key)
    SELECT c.id, ${BigInt(input.amount)}::bigint, ${input.idempotencyKey}::text
    FROM contracts c
    WHERE c.id = ${input.contractId}::uuid AND c.company_id = ${companyId}::uuid
    RETURNING id, amount, created_at AS "createdAt"
  `;
  return row ?? null;
}

export function findPayments(companyId: string, contractId: string, tx?: Tx) {
  const db = tx ?? getDb();
  return db.payment.findMany({
    where: { contractId, contract: { companyId } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: paymentSelect,
  });
}

export async function sumPayments(companyId: string, contractId: string, tx?: Tx) {
  const db = tx ?? getDb();
  const result = await db.payment.aggregate({
    where: { contractId, contract: { companyId } },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0n;
}

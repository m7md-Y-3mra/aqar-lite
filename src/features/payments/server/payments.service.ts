import "server-only";

import {
  addInstallmentPaid,
  findContractTotals,
  findOpenInstallments,
  lockContract,
} from "@/features/contracts/server";
import { insertAuditLog } from "@/server/audit/audit.repository";
import type { SessionUser } from "@/server/auth/session.service";
import { withTransaction } from "@/server/db";
import { AppError } from "@/server/http/app-error";
import {
  idempotencyKeyReusedMessage,
  paymentExceedsRemainingMessage,
} from "@/shared/lib/error-messages";
import { allocatePayment, openAmount } from "../domain/allocation";
import type { ContractPaymentsDto, PaymentDto, RecordPaymentInput } from "../payments.types";
import { findPaymentByKey, findPayments, insertPayment, sumPayments } from "./payments.repository";

type PaymentRow = { id: string; amount: bigint; createdAt: Date };

function toPaymentDto(row: PaymentRow): PaymentDto {
  return { id: row.id, amount: Number(row.amount), createdAt: row.createdAt.toISOString() };
}

export type RecordPaymentResult = { payment: PaymentDto; replayed: boolean };

/**
 * One transaction: lock the contract row, so payments of one contract run one at a time;
 * then the key check (before the amount check, so a retry of a final payment is not an overpayment),
 * the amount check, the payment, the paid amounts and the audit row.
 */
export async function recordPayment(
  user: SessionUser,
  contractId: string,
  input: RecordPaymentInput,
  idempotencyKey: string,
): Promise<RecordPaymentResult> {
  if (user.role !== "ACCOUNTANT") throw new AppError("FORBIDDEN");

  return withTransaction(async (tx) => {
    const contract = await lockContract(user.companyId, contractId, tx);
    if (contract === null) throw new AppError("NOT_FOUND");
    if (contract.approvedAt === null) throw new AppError("CONTRACT_NOT_APPROVED");

    const existing = await findPaymentByKey(user.companyId, contractId, idempotencyKey, tx);
    if (existing !== null) {
      const savedAmount = Number(existing.amount);
      if (savedAmount !== input.amount) {
        throw new AppError(
          "IDEMPOTENCY_KEY_REUSED",
          undefined,
          idempotencyKeyReusedMessage(savedAmount),
        );
      }
      return { payment: toPaymentDto(existing), replayed: true };
    }

    const lines = (await findOpenInstallments(user.companyId, contractId, tx)).map((line) => ({
      id: line.id,
      seq: line.seq,
      amount: Number(line.amount),
      paidAmount: Number(line.paidAmount),
    }));
    const remaining = openAmount(lines);
    if (input.amount > remaining) {
      throw new AppError(
        "PAYMENT_EXCEEDS_REMAINING",
        undefined,
        paymentExceedsRemainingMessage(remaining),
      );
    }
    const allocation = allocatePayment(lines, input.amount);

    const payment = await insertPayment(
      user.companyId,
      { contractId, amount: input.amount, idempotencyKey },
      tx,
    );
    if (payment === null) throw new AppError("NOT_FOUND");
    for (const item of allocation) {
      if ((await addInstallmentPaid(user.companyId, item.installmentId, item.applied, tx)) !== 1) {
        throw new Error(`Installment ${item.installmentId} was not updated`);
      }
    }

    await insertAuditLog(
      {
        action: "PAYMENT_RECORDED",
        companyId: user.companyId,
        userId: user.userId,
        entityId: payment.id,
        meta: {
          contractId,
          amount: input.amount,
          allocation: allocation.map(({ seq, applied }) => ({ seq, applied })),
          remainingAfter: remaining - input.amount,
        },
        createdAt: payment.createdAt,
      },
      tx,
    );
    return { payment: toPaymentDto(payment), replayed: false };
  });
}

export async function listPayments(
  user: SessionUser,
  contractId: string,
): Promise<ContractPaymentsDto> {
  if (user.role !== "ACCOUNTANT" && user.role !== "MANAGER") throw new AppError("FORBIDDEN");

  const contract = await findContractTotals(user.companyId, contractId);
  if (contract === null) throw new AppError("NOT_FOUND");
  const finalPrice = Number(contract.finalPrice);
  if (contract.approvedAt === null) return { approved: false, remaining: finalPrice, payments: [] };

  const [payments, paid] = await Promise.all([
    findPayments(user.companyId, contractId),
    sumPayments(user.companyId, contractId),
  ]);
  return {
    approved: true,
    remaining: finalPrice - Number(paid),
    payments: payments.map(toPaymentDto),
  };
}

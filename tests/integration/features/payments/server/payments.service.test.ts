import { beforeEach, describe, expect, it } from "vitest";

import { listPayments, recordPayment } from "@/features/payments/server/payments.service";
import { getDb } from "@/server/db";
import { AppError } from "@/server/http/app-error";
import { makeTwoCompanies } from "../../../support/session-users";
import {
  LINES,
  makeApprovedContract,
  makeDraftContract,
  newKey,
  paidBySeq,
  paymentAudits,
  paymentCount,
} from "./payments-fixtures";

let companies: Awaited<ReturnType<typeof makeTwoCompanies>>;

beforeEach(async () => {
  companies = await makeTwoCompanies();
});

const pay = (contractId: string, amount: number, key = newKey()) =>
  recordPayment(companies.a.accountant, contractId, { amount }, key);

async function expectCode(promise: Promise<unknown>, code: string) {
  const error = await promise.then(
    () => null,
    (err: unknown) => err,
  );
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).code).toBe(code);
  return error as AppError;
}

describe("record", () => {
  it("allocates to the oldest lines first and writes one audit row with the allocation", async () => {
    const contract = await makeApprovedContract(companies.a.sales1);
    await pay(contract.id, 2_000_000);
    const { payment, replayed } = await pay(contract.id, 4_500_000);

    expect(replayed).toBe(false);
    expect(payment.amount).toBe(4_500_000);
    expect(await paidBySeq(contract.id)).toEqual([5_000_000, 1_000_000, 500_000, 0]);
    const audits = await paymentAudits(contract.id);
    expect(audits).toHaveLength(2);
    const last = audits.find((row) => row.entityId === payment.id)!;
    expect(last.userId).toBe(companies.a.accountant.userId);
    expect(last.companyId).toBe(companies.a.companyId);
    expect(last.meta).toEqual({
      contractId: contract.id,
      amount: 4_500_000,
      allocation: [
        { seq: 0, applied: 3_000_000 },
        { seq: 1, applied: 1_000_000 },
        { seq: 2, applied: 500_000 },
      ],
      remainingAfter: 1_500_000,
    });
  });

  it("an exact final payment pays every line and leaves nothing", async () => {
    const contract = await makeApprovedContract(companies.a.sales1, [500_000, 333_367]);
    await pay(contract.id, contract.finalPrice);
    expect(await paidBySeq(contract.id)).toEqual([500_000, 333_367]);
    expect((await listPayments(companies.a.accountant, contract.id)).remaining).toBe(0);
  });

  it("a contract with no down payment line starts at seq 1", async () => {
    const contract = await makeApprovedContract(companies.a.sales1, LINES.slice(1), {
      withDownPayment: false,
    });
    const { payment } = await pay(contract.id, 1_500_000);
    expect(await paidBySeq(contract.id)).toEqual([1_000_000, 500_000, 0]);
    const [audit] = await paymentAudits(contract.id);
    expect(audit!.entityId).toBe(payment.id);
    expect(audit!.meta).toMatchObject({
      allocation: [
        { seq: 1, applied: 1_000_000 },
        { seq: 2, applied: 500_000 },
      ],
    });
  });

  it("amount above remaining → PAYMENT_EXCEEDS_REMAINING naming the remaining, nothing changes", async () => {
    const contract = await makeApprovedContract(companies.a.sales1);
    await pay(contract.id, contract.finalPrice - 100_000);
    const error = await expectCode(pay(contract.id, 100_001), "PAYMENT_EXCEEDS_REMAINING");
    expect(error.userMessage).toContain("1,000.00");
    expect(await paymentCount(contract.id)).toBe(1);
    expect(await paymentAudits(contract.id)).toHaveLength(1);
  });

  it("fully paid contract refuses any new payment", async () => {
    const contract = await makeApprovedContract(companies.a.sales1);
    await pay(contract.id, contract.finalPrice);
    await expectCode(pay(contract.id, 1), "PAYMENT_EXCEEDS_REMAINING");
  });

  it("draft contract → CONTRACT_NOT_APPROVED, no payment", async () => {
    const draft = await makeDraftContract(companies.a.sales1);
    await expectCode(pay(draft.id, 100), "CONTRACT_NOT_APPROVED");
    expect(await paymentCount(draft.id)).toBe(0);
  });

  it("MANAGER and SALES cannot record (FORBIDDEN), nothing saved", async () => {
    const contract = await makeApprovedContract(companies.a.sales1);
    for (const user of [companies.a.manager, companies.a.sales1]) {
      await expectCode(recordPayment(user, contract.id, { amount: 100 }, newKey()), "FORBIDDEN");
    }
    expect(await paymentCount(contract.id)).toBe(0);
  });

  it("accountant of company B on A's contract → NOT_FOUND, also with A's key", async () => {
    const contract = await makeApprovedContract(companies.a.sales1);
    const key = newKey();
    await pay(contract.id, 100, key);
    await expectCode(
      recordPayment(companies.b.accountant, contract.id, { amount: 100 }, key),
      "NOT_FOUND",
    );
    await expectCode(
      recordPayment(companies.b.accountant, contract.id, { amount: 200 }, newKey()),
      "NOT_FOUND",
    );
    expect(await paymentCount(contract.id)).toBe(1);
  });

  it("Σ payments = Σ paid amounts ≤ final price after several payments", async () => {
    const contract = await makeApprovedContract(companies.a.sales1);
    for (const amount of [1, 4_999_999, 777, 1_000_000, 123_456]) await pay(contract.id, amount);
    const paid = (await paidBySeq(contract.id)).reduce((sum, value) => sum + value, 0);
    const payments = await getDb().payment.aggregate({
      where: { contractId: contract.id },
      _sum: { amount: true },
    });
    expect(Number(payments._sum.amount)).toBe(paid);
    expect(paid).toBeLessThanOrEqual(contract.finalPrice);
  });

  it("all-or-nothing: forced failure on the audit insert leaves no payment and no paid amounts", async () => {
    const contract = await makeApprovedContract(companies.a.sales1);
    const db = getDb();
    try {
      await db.$executeRawUnsafe(
        `CREATE FUNCTION test_fail_payment_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced failure'; END; $$`,
      );
      await db.$executeRawUnsafe(
        `CREATE TRIGGER test_fail_payment_audit BEFORE INSERT ON audit_logs FOR EACH ROW WHEN (NEW.action = 'PAYMENT_RECORDED' AND NEW.meta->>'contractId' = '${contract.id}') EXECUTE FUNCTION test_fail_payment_audit()`,
      );
      await expect(pay(contract.id, 2_000_000)).rejects.toThrow();
      expect(await paymentCount(contract.id)).toBe(0);
      expect(await paidBySeq(contract.id)).toEqual([0, 0, 0, 0]);
    } finally {
      await db.$executeRawUnsafe("DROP TRIGGER IF EXISTS test_fail_payment_audit ON audit_logs");
      await db.$executeRawUnsafe("DROP FUNCTION IF EXISTS test_fail_payment_audit()");
    }
  });
});

describe("repeated requests", () => {
  it("same key twice → one payment, one audit row, original returned", async () => {
    const contract = await makeApprovedContract(companies.a.sales1);
    const key = newKey();
    const first = await pay(contract.id, 2_000_000, key);
    const second = await pay(contract.id, 2_000_000, key);

    expect(second).toEqual({ payment: first.payment, replayed: true });
    expect(await paymentCount(contract.id)).toBe(1);
    expect(await paymentAudits(contract.id)).toHaveLength(1);
    expect(await paidBySeq(contract.id)).toEqual([2_000_000, 0, 0, 0]);
  });

  it("retry after an exact final payment returns the original, not an overpayment", async () => {
    const contract = await makeApprovedContract(companies.a.sales1);
    const key = newKey();
    const first = await pay(contract.id, contract.finalPrice, key);
    expect(await pay(contract.id, contract.finalPrice, key)).toEqual({
      payment: first.payment,
      replayed: true,
    });
  });

  it("same key on another contract → a separate payment", async () => {
    const one = await makeApprovedContract(companies.a.sales1);
    const two = await makeApprovedContract(companies.a.sales1);
    const key = newKey();
    await pay(one.id, 100, key);
    expect((await pay(two.id, 100, key)).replayed).toBe(false);
    expect(await paymentCount(two.id)).toBe(1);
  });

  it("same key, different amount → IDEMPOTENCY_KEY_REUSED naming the saved amount, count unchanged", async () => {
    const contract = await makeApprovedContract(companies.a.sales1);
    const key = newKey();
    await pay(contract.id, 500_000, key);
    const error = await expectCode(pay(contract.id, 600_000, key), "IDEMPOTENCY_KEY_REUSED");
    expect(error.userMessage).toContain("5,000.00");
    expect(await paymentCount(contract.id)).toBe(1);
    expect(await paymentAudits(contract.id)).toHaveLength(1);
  });

  it("parallel requests with the same key → exactly one payment (×5)", async () => {
    for (let round = 0; round < 5; round += 1) {
      const contract = await makeApprovedContract(companies.a.sales1);
      const key = newKey();
      const results = await Promise.all([
        pay(contract.id, 700_000, key),
        pay(contract.id, 700_000, key),
      ]);
      expect(results[0].payment.id).toBe(results[1].payment.id);
      expect(results.map((r) => r.replayed).sort()).toEqual([false, true]);
      expect(await paymentCount(contract.id)).toBe(1);
      expect(await paidBySeq(contract.id)).toEqual([700_000, 0, 0, 0]);
    }
  });
});

describe("concurrency", () => {
  it("two parallel payments above the remaining amount → exactly one succeeds (×5)", async () => {
    for (let round = 0; round < 5; round += 1) {
      const contract = await makeApprovedContract(companies.a.sales1);
      await pay(contract.id, contract.finalPrice - 1_000_000); // 10,000 riyals left
      const results = await Promise.allSettled([
        pay(contract.id, 600_000),
        pay(contract.id, 600_000),
      ]);
      const failed = results.filter((r) => r.status === "rejected");
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(failed).toHaveLength(1);
      const reason = (failed[0] as PromiseRejectedResult).reason as AppError;
      expect(reason.code).toBe("PAYMENT_EXCEEDS_REMAINING");
      expect(reason.userMessage).toContain("4,000.00");
      expect((await listPayments(companies.a.accountant, contract.id)).remaining).toBe(400_000);
    }
  });

  it("two parallel payments within the remaining amount → both recorded", async () => {
    const contract = await makeApprovedContract(companies.a.sales1);
    await pay(contract.id, contract.finalPrice - 1_000_000);
    await Promise.all([pay(contract.id, 400_000), pay(contract.id, 400_000)]);
    expect((await listPayments(companies.a.accountant, contract.id)).remaining).toBe(200_000);
  });
});

describe("list", () => {
  it("ACCOUNTANT and MANAGER see payments newest first with remaining", async () => {
    const contract = await makeApprovedContract(companies.a.sales1);
    const first = await pay(contract.id, 100_000);
    const second = await pay(contract.id, 200_000);
    for (const user of [companies.a.accountant, companies.a.manager]) {
      expect(await listPayments(user, contract.id)).toEqual({
        approved: true,
        remaining: contract.finalPrice - 300_000,
        payments: [second.payment, first.payment],
      });
    }
  });

  it("SALES → FORBIDDEN, even on their own contract", async () => {
    const contract = await makeApprovedContract(companies.a.sales1);
    await expectCode(listPayments(companies.a.sales1, contract.id), "FORBIDDEN");
  });

  it("draft → approved false, empty list, remaining = final price", async () => {
    const draft = await makeDraftContract(companies.a.sales1);
    expect(await listPayments(companies.a.accountant, draft.id)).toEqual({
      approved: false,
      remaining: Number(draft.finalPrice),
      payments: [],
    });
  });

  it("company B listing A's contract → NOT_FOUND", async () => {
    const contract = await makeApprovedContract(companies.a.sales1);
    for (const user of [companies.b.accountant, companies.b.manager]) {
      await expectCode(listPayments(user, contract.id), "NOT_FOUND");
    }
  });
});

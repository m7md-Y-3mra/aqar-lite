import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getDb } from "@/server/db";
import { expectDbError, makeContractChain, makePayment } from "../support/db-fixtures";

let paymentId: string;
let auditId: string;
let originalPayment: Record<string, unknown>[];
let originalAudit: Record<string, unknown>[];

beforeAll(async () => {
  const db = getDb();
  const chain = await makeContractChain();
  const payment = await makePayment(chain.contractId);
  const audit = await db.auditLog.create({
    data: {
      companyId: chain.companyId,
      userId: chain.salesRepId,
      action: "PRICE_CHANGED",
      meta: { old: 1, new: 2 },
    },
  });
  paymentId = payment.id;
  auditId = audit.id;
  originalPayment = await db.$queryRaw`
    SELECT * FROM payments WHERE id = ${paymentId}::uuid
  `;
  originalAudit = await db.$queryRaw`
    SELECT * FROM audit_logs WHERE id = ${auditId}::uuid
  `;
  expect(originalPayment).toHaveLength(1);
  expect(originalAudit).toHaveLength(1);
});

afterAll(async () => {
  await getDb().$disconnect();
});

async function expectPaymentUnchanged() {
  const rows = await getDb().$queryRaw`
    SELECT * FROM payments WHERE id = ${paymentId}::uuid
  `;
  expect(rows).toEqual(originalPayment);
}

async function expectAuditUnchanged() {
  const rows = await getDb().$queryRaw`
    SELECT * FROM audit_logs WHERE id = ${auditId}::uuid
  `;
  expect(rows).toEqual(originalAudit);
}

describe("append-only rows", () => {
  it("UPDATE on a payment fails", async () => {
    await expectDbError(
      getDb().$executeRaw`UPDATE payments SET amount = ${200_000n} WHERE id = ${paymentId}::uuid`,
      { code: "AQ001" },
    );
    await expectPaymentUnchanged();
  });

  it("DELETE on a payment fails", async () => {
    await expectDbError(
      getDb().$executeRaw`DELETE FROM payments WHERE id = ${paymentId}::uuid`,
      { code: "AQ001" },
    );
    await expectPaymentUnchanged();
  });

  it("TRUNCATE payments fails", async () => {
    await expectDbError(getDb().$executeRaw`TRUNCATE payments`, { code: "AQ001" });
    await expectPaymentUnchanged();
  });

  it("UPDATE on an audit row fails", async () => {
    await expectDbError(
      getDb().$executeRaw`UPDATE audit_logs SET meta = '{}'::jsonb WHERE id = ${auditId}::uuid`,
      { code: "AQ001" },
    );
    await expectAuditUnchanged();
  });

  it("DELETE on an audit row fails", async () => {
    await expectDbError(
      getDb().$executeRaw`DELETE FROM audit_logs WHERE id = ${auditId}::uuid`,
      { code: "AQ001" },
    );
    await expectAuditUnchanged();
  });

  it("TRUNCATE audit_logs fails", async () => {
    await expectDbError(getDb().$executeRaw`TRUNCATE audit_logs`, { code: "AQ001" });
    await expectAuditUnchanged();
  });

  it("inserts a payment and an audit row", async () => {
    const db = getDb();
    const chain = await makeContractChain();
    expect(
      await db.$executeRaw`
        INSERT INTO payments (contract_id, amount, idempotency_key)
        VALUES (${chain.contractId}::uuid, ${100_000n}, ${"append-only-insert-control"})
      `,
    ).toBe(1);
    expect(
      await db.$executeRaw`
        INSERT INTO audit_logs (company_id, user_id, action, meta)
        VALUES (${chain.companyId}::uuid, ${chain.salesRepId}::uuid, 'PRICE_CHANGED', '{"old":1,"new":2}'::jsonb)
      `,
    ).toBe(1);
  });
});

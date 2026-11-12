import { createHash, randomBytes, randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

import { getDb } from "@/server/db";
import {
  expectDbError,
  makeClient,
  makeCompany,
  makeContract,
  makeContractChain,
  makeInstallment,
  makePayment,
  makeReservation,
  makeUnit,
  makeUser,
} from "../support/db-fixtures";

afterAll(async () => {
  await getDb().$disconnect();
});

describe("data model", () => {
  it("creates a full company → contract → installment chain", async () => {
    const db = getDb();
    const chain = await makeContractChain();
    const installment = await makeInstallment(chain.contractId);
    const payment = await makePayment(chain.contractId);
    const audit = await db.auditLog.create({
      data: {
        companyId: chain.companyId,
        userId: chain.salesRepId,
        action: "PAYMENT_RECORDED",
        entityId: payment.id,
        meta: { amount: 100_000 },
      },
    });
    const session = await db.session.create({
      data: {
        id: createHash("sha256").update(randomBytes(32)).digest("hex"),
        userId: chain.salesRepId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    expect(installment.contractId).toBe(chain.contractId);
    expect(payment.contractId).toBe(chain.contractId);
    expect(audit.companyId).toBe(chain.companyId);
    expect(audit.entityId).toBe(payment.id);
    expect(session.userId).toBe(chain.salesRepId);
  });

  it("rejects a user without a company", async () => {
    const db = getDb();
    await expectDbError(
      db.$executeRaw`
        INSERT INTO users (company_id, name, email, password_hash, role)
        VALUES (NULL, 'مستخدم اختبار', ${`${randomUUID()}@fixtures.test`}, 'fixture-hash', 'SALES')
      `,
      { code: "23502" },
    );

    const company = await makeCompany();
    expect((await makeUser(company.id)).companyId).toBe(company.id);
  });

  it("rejects an unknown role", async () => {
    const db = getDb();
    const company = await makeCompany();
    await expectDbError(
      db.$executeRaw`
        INSERT INTO users (company_id, name, email, password_hash, role)
        VALUES (${company.id}::uuid, 'مستخدم اختبار', ${`${randomUUID()}@fixtures.test`}, 'fixture-hash', 'ADMIN')
      `,
      { code: "22P02" },
    );

    expect((await makeUser(company.id, "SALES")).role).toBe("SALES");
  });

  it("rejects a duplicate email", async () => {
    const db = getDb();
    const companyA = await makeCompany();
    const companyB = await makeCompany();
    const user = await makeUser(companyA.id);
    await expectDbError(
      db.$executeRaw`
        INSERT INTO users (company_id, name, email, password_hash, role)
        VALUES (${companyB.id}::uuid, 'مستخدم اختبار', ${user.email}, 'fixture-hash', 'SALES')
      `,
      { code: "23505", constraint: "users_email_key" },
    );

    expect((await makeUser(companyB.id)).email).not.toBe(user.email);
  });

  it("rejects a non-normalized email", async () => {
    const db = getDb();
    const company = await makeCompany();
    await expectDbError(
      db.$executeRaw`
        INSERT INTO users (company_id, name, email, password_hash, role)
        VALUES (${company.id}::uuid, 'مستخدم اختبار', ${" Ali@X.test"}, 'fixture-hash', 'SALES')
      `,
      { code: "23514", constraint: "users_email_normalized_check" },
    );

    const email = `${randomUUID()}@fixtures.test`;
    expect(
      await db.$executeRaw`
        INSERT INTO users (company_id, name, email, password_hash, role)
        VALUES (${company.id}::uuid, 'مستخدم اختبار', ${email}, 'fixture-hash', 'SALES')
      `,
    ).toBe(1);
  });

  it("rejects a unit for a missing company", async () => {
    const db = getDb();
    await expectDbError(
      db.$executeRaw`
        INSERT INTO units (company_id, project_name, number, type, area, rooms, price)
        VALUES (${randomUUID()}::uuid, 'مشروع اختبار', ${randomUUID()}, 'APARTMENT', 120, 3, ${100_000_00n})
      `,
      { code: "23503", constraint: "units_company_id_fkey" },
    );

    const company = await makeCompany();
    expect((await makeUnit(company.id)).companyId).toBe(company.id);
  });

  it("refuses to delete a unit that has a reservation", async () => {
    const db = getDb();
    const chain = await makeContractChain();
    await expectDbError(db.$executeRaw`DELETE FROM units WHERE id = ${chain.unitId}::uuid`, {
      code: "23001",
      constraint: "reservations_company_id_unit_id_fkey",
    });
    expect(await db.unit.findUnique({ where: { id: chain.unitId } })).not.toBeNull();
    expect(await db.reservation.findUnique({ where: { id: chain.reservationId } })).not.toBeNull();

    const unusedUnit = await makeUnit(chain.companyId);
    expect(await db.$executeRaw`DELETE FROM units WHERE id = ${unusedUnit.id}::uuid`).toBe(1);
    expect(await db.unit.findUnique({ where: { id: unusedUnit.id } })).toBeNull();
  });

  it("accepts two clients with the same phone", async () => {
    const chain = await makeContractChain();
    const first = await makeClient(chain.companyId, chain.salesRepId, { phone: "0512345678" });
    const second = await makeClient(chain.companyId, chain.salesRepId, { phone: first.phone });

    expect(second.id).not.toBe(first.id);
    expect(second.phone).toBe(first.phone);
  });

  it("rejects a session id that is not a SHA-256 hex hash", async () => {
    const db = getDb();
    const company = await makeCompany();
    const user = await makeUser(company.id);
    const rawToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    expect(rawToken).toHaveLength(43);
    await expectDbError(
      db.$executeRaw`
        INSERT INTO sessions (id, user_id, expires_at)
        VALUES (${rawToken}, ${user.id}::uuid, ${expiresAt})
      `,
      { code: "23514", constraint: "sessions_id_hash_check" },
    );

    const hash = createHash("sha256").update(randomBytes(32)).digest("hex");
    expect((await db.session.create({ data: { id: hash, userId: user.id, expiresAt } })).id).toBe(
      hash,
    );
  });
});

describe("company links", () => {
  it("rejects a client whose sales rep belongs to another company", async () => {
    const db = getDb();
    const a = await makeContractChain();
    const b = await makeContractChain();
    await expectDbError(
      db.$executeRaw`
        INSERT INTO clients (company_id, sales_rep_id, name, phone)
        VALUES (${a.companyId}::uuid, ${b.salesRepId}::uuid, 'عميل اختبار', '0500000000')
      `,
      { code: "23503", constraint: "clients_company_id_sales_rep_id_fkey" },
    );

    expect((await makeClient(a.companyId, a.salesRepId)).salesRepId).toBe(a.salesRepId);
  });

  it("rejects a reservation whose unit belongs to another company", async () => {
    const db = getDb();
    const a = await makeContractChain();
    const b = await makeContractChain();
    await expectDbError(
      db.$executeRaw`
        INSERT INTO reservations (company_id, unit_id, client_id, sales_rep_id, expires_at)
        VALUES (${a.companyId}::uuid, ${b.unitId}::uuid, ${a.clientId}::uuid, ${a.salesRepId}::uuid, ${new Date()})
      `,
      { code: "23503", constraint: "reservations_company_id_unit_id_fkey" },
    );

    expect(
      (
        await makeReservation({
          companyId: a.companyId,
          unitId: a.unitId,
          clientId: a.clientId,
          salesRepId: a.salesRepId,
        })
      ).unitId,
    ).toBe(a.unitId);
  });

  it("rejects a reservation whose client belongs to another company", async () => {
    const db = getDb();
    const a = await makeContractChain();
    const b = await makeContractChain();
    await expectDbError(
      db.$executeRaw`
        INSERT INTO reservations (company_id, unit_id, client_id, sales_rep_id, expires_at)
        VALUES (${a.companyId}::uuid, ${a.unitId}::uuid, ${b.clientId}::uuid, ${a.salesRepId}::uuid, ${new Date()})
      `,
      { code: "23503", constraint: "reservations_company_id_client_id_fkey" },
    );

    expect(
      (
        await makeReservation({
          companyId: a.companyId,
          unitId: a.unitId,
          clientId: a.clientId,
          salesRepId: a.salesRepId,
        })
      ).clientId,
    ).toBe(a.clientId);
  });

  it("rejects a reservation whose sales rep belongs to another company", async () => {
    const db = getDb();
    const a = await makeContractChain();
    const b = await makeContractChain();
    await expectDbError(
      db.$executeRaw`
        INSERT INTO reservations (company_id, unit_id, client_id, sales_rep_id, expires_at)
        VALUES (${a.companyId}::uuid, ${a.unitId}::uuid, ${a.clientId}::uuid, ${b.salesRepId}::uuid, ${new Date()})
      `,
      { code: "23503", constraint: "reservations_company_id_sales_rep_id_fkey" },
    );

    expect(
      (
        await makeReservation({
          companyId: a.companyId,
          unitId: a.unitId,
          clientId: a.clientId,
          salesRepId: a.salesRepId,
        })
      ).salesRepId,
    ).toBe(a.salesRepId);
  });

  it("rejects a contract whose reservation belongs to another company", async () => {
    const db = getDb();
    const a = await makeContractChain();
    const b = await makeContractChain();
    // Use unused reservations so uniqueness cannot hide the company-link violation.
    const ownReservation = await makeReservation({
      companyId: a.companyId,
      unitId: a.unitId,
      clientId: a.clientId,
      salesRepId: a.salesRepId,
    });
    const otherReservation = await makeReservation({
      companyId: b.companyId,
      unitId: b.unitId,
      clientId: b.clientId,
      salesRepId: b.salesRepId,
    });
    await expectDbError(
      db.$executeRaw`
        INSERT INTO contracts (company_id, reservation_id, final_price, down_payment, installment_count)
        VALUES (${a.companyId}::uuid, ${otherReservation.id}::uuid, ${100_000_00n}, ${0n}, 10)
      `,
      { code: "23503", constraint: "contracts_company_id_reservation_id_fkey" },
    );

    expect((await makeContract(a.companyId, ownReservation.id)).reservationId).toBe(
      ownReservation.id,
    );
  });
});

describe("business rules", () => {
  it.each([
    {
      name: "price 0",
      price: 0n,
      area: 120,
      rooms: 3,
      number: "A-101",
      constraint: "units_price_check",
    },
    {
      name: "price -1",
      price: -1n,
      area: 120,
      rooms: 3,
      number: "A-101",
      constraint: "units_price_check",
    },
    {
      name: "area 0",
      price: 100_000_00n,
      area: 0,
      rooms: 3,
      number: "A-101",
      constraint: "units_area_check",
    },
    {
      name: "rooms -1",
      price: 100_000_00n,
      area: 120,
      rooms: -1,
      number: "A-101",
      constraint: "units_rooms_check",
    },
    {
      name: "number with trailing whitespace",
      price: 100_000_00n,
      area: 120,
      rooms: 3,
      number: "A-101 ",
      constraint: "units_number_check",
    },
  ])("rejects unit $name", async ({ price, area, rooms, number, constraint }) => {
    const db = getDb();
    const company = await makeCompany();
    await expectDbError(
      db.$executeRaw`
        INSERT INTO units (company_id, project_name, number, type, area, rooms, price)
        VALUES (${company.id}::uuid, 'مشروع اختبار', ${number}, 'APARTMENT', ${area}, ${rooms}, ${price})
      `,
      { code: "23514", constraint },
    );

    expect((await makeUnit(company.id, { number: "A-101" })).number).toBe("A-101");
  });

  it("rejects a duplicate project and number in one company", async () => {
    const db = getDb();
    const company = await makeCompany();
    const otherCompany = await makeCompany();
    const unit = await makeUnit(company.id, { number: "A-101" });
    await expectDbError(
      db.$executeRaw`
        INSERT INTO units (company_id, project_name, number, type, area, rooms, price)
        VALUES (${company.id}::uuid, ${unit.projectName}, ${unit.number}, 'APARTMENT', 120, 3, ${100_000_00n})
      `,
      { code: "23505", constraint: "units_company_id_project_name_number_key" },
    );

    expect(
      (await makeUnit(otherCompany.id, { projectName: unit.projectName, number: unit.number }))
        .companyId,
    ).toBe(otherCompany.id);
    expect(
      (await makeUnit(company.id, { projectName: "مشروع آخر", number: unit.number })).projectName,
    ).toBe("مشروع آخر");
  });

  it("rejects final price 0", async () => {
    const db = getDb();
    const chain = await makeContractChain();
    const reservation = await makeReservation({
      companyId: chain.companyId,
      unitId: chain.unitId,
      clientId: chain.clientId,
      salesRepId: chain.salesRepId,
    });
    // Any final_price <= 0 also breaks down_payment >= 0 AND down_payment < final_price; Postgres reports the first violated CHECK by name.
    await expectDbError(
      db.$executeRaw`
        INSERT INTO contracts (company_id, reservation_id, final_price, down_payment, installment_count)
        VALUES (${chain.companyId}::uuid, ${reservation.id}::uuid, ${0n}, ${0n}, 10)
      `,
      { code: "23514", constraint: "contracts_down_payment_check" },
    );

    expect((await makeContract(chain.companyId, reservation.id)).finalPrice).toBe(100_000_00n);
  });

  it("declares the final price CHECK on contracts", async () => {
    const constraints = await getDb().$queryRaw<{ conname: string }[]>`
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'public.contracts'::regclass
        AND contype = 'c'
        AND conname = ${"contracts_final_price_check"}
    `;

    expect(constraints).toEqual([{ conname: "contracts_final_price_check" }]);
  });

  it.each([
    {
      name: "down payment -1",
      downPayment: -1n,
      installmentCount: 10,
      constraint: "contracts_down_payment_check",
    },
    {
      name: "down payment equal to final price",
      downPayment: 100_000_00n,
      installmentCount: 10,
      constraint: "contracts_down_payment_check",
    },
    {
      name: "installment count 0",
      downPayment: 0n,
      installmentCount: 0,
      constraint: "contracts_installment_count_check",
    },
  ])("rejects $name", async ({ downPayment, installmentCount, constraint }) => {
    const db = getDb();
    const chain = await makeContractChain();
    const reservation = await makeReservation({
      companyId: chain.companyId,
      unitId: chain.unitId,
      clientId: chain.clientId,
      salesRepId: chain.salesRepId,
    });
    await expectDbError(
      db.$executeRaw`
        INSERT INTO contracts (company_id, reservation_id, final_price, down_payment, installment_count)
        VALUES (${chain.companyId}::uuid, ${reservation.id}::uuid, ${100_000_00n}, ${downPayment}, ${installmentCount})
      `,
      { code: "23514", constraint },
    );

    expect(
      (await makeContract(chain.companyId, reservation.id, { downPayment: 0n })).downPayment,
    ).toBe(0n);
  });

  it("rejects a second contract for the same reservation", async () => {
    const db = getDb();
    const chain = await makeContractChain();
    await expectDbError(
      db.$executeRaw`
        INSERT INTO contracts (company_id, reservation_id, final_price, down_payment, installment_count)
        VALUES (${chain.companyId}::uuid, ${chain.reservationId}::uuid, ${100_000_00n}, ${0n}, 10)
      `,
      { code: "23505", constraint: "contracts_reservation_id_key" },
    );

    const reservation = await makeReservation({
      companyId: chain.companyId,
      unitId: chain.unitId,
      clientId: chain.clientId,
      salesRepId: chain.salesRepId,
    });
    expect((await makeContract(chain.companyId, reservation.id)).reservationId).toBe(
      reservation.id,
    );
  });

  it.each([
    {
      name: "paid amount above amount",
      amount: 1_000_000n,
      paidAmount: 1_000_001n,
      seq: 1,
      constraint: "installments_paid_amount_check",
    },
    {
      name: "installment amount 0",
      amount: 0n,
      paidAmount: 0n,
      seq: 1,
      constraint: "installments_amount_check",
    },
    {
      name: "paid amount -1",
      amount: 1_000_000n,
      paidAmount: -1n,
      seq: 1,
      constraint: "installments_paid_amount_check",
    },
    {
      name: "installment seq -1",
      amount: 1_000_000n,
      paidAmount: 0n,
      seq: -1,
      constraint: "installments_seq_check",
    },
  ])("rejects $name", async ({ amount, paidAmount, seq, constraint }) => {
    const db = getDb();
    const chain = await makeContractChain();
    await expectDbError(
      db.$executeRaw`
        INSERT INTO installments (contract_id, seq, due_date, amount, paid_amount)
        VALUES (${chain.contractId}::uuid, ${seq}, ${new Date(Date.UTC(2026, 0, 31))}, ${amount}, ${paidAmount})
      `,
      { code: "23514", constraint },
    );

    expect((await makeInstallment(chain.contractId)).seq).toBe(1);
  });

  it("accepts paid = amount", async () => {
    const chain = await makeContractChain();
    const installment = await makeInstallment(chain.contractId, {
      amount: 1_000_000n,
      paidAmount: 1_000_000n,
    });

    expect(installment.paidAmount).toBe(installment.amount);
  });

  it("rejects a duplicate seq in one contract", async () => {
    const db = getDb();
    const chain = await makeContractChain();
    const installment = await makeInstallment(chain.contractId);
    await expectDbError(
      db.$executeRaw`
        INSERT INTO installments (contract_id, seq, due_date, amount, paid_amount)
        VALUES (${chain.contractId}::uuid, ${installment.seq}, ${installment.dueDate}, ${1_000_000n}, ${0n})
      `,
      { code: "23505", constraint: "installments_contract_id_seq_key" },
    );

    expect((await makeInstallment(chain.contractId, { seq: 2 })).seq).toBe(2);
  });

  it.each([
    {
      name: "payment amount 0",
      amount: 0n,
      idempotencyKey: randomUUID(),
      constraint: "payments_amount_check",
    },
    {
      name: "empty payment key",
      amount: 100_000n,
      idempotencyKey: "",
      constraint: "payments_idempotency_key_check",
    },
  ])("rejects $name", async ({ amount, idempotencyKey, constraint }) => {
    const db = getDb();
    const chain = await makeContractChain();
    await expectDbError(
      db.$executeRaw`
        INSERT INTO payments (contract_id, amount, idempotency_key)
        VALUES (${chain.contractId}::uuid, ${amount}, ${idempotencyKey})
      `,
      { code: "23514", constraint },
    );

    expect((await makePayment(chain.contractId)).amount).toBe(100_000n);
  });

  it("rejects a repeated key on one contract", async () => {
    const db = getDb();
    const chain = await makeContractChain();
    const otherChain = await makeContractChain();
    const payment = await makePayment(chain.contractId);
    await expectDbError(
      db.$executeRaw`
        INSERT INTO payments (contract_id, amount, idempotency_key)
        VALUES (${chain.contractId}::uuid, ${100_000n}, ${payment.idempotencyKey})
      `,
      { code: "23505", constraint: "payments_contract_id_idempotency_key_key" },
    );

    expect(
      (await makePayment(otherChain.contractId, { idempotencyKey: payment.idempotencyKey }))
        .idempotencyKey,
    ).toBe(payment.idempotencyKey);
  });

  it.each([
    { name: "with a mixed-case email", meta: { email: "Ali@X.test" } },
    { name: "without an email", meta: {} },
  ])("rejects LOGIN_FAILED $name", async ({ meta }) => {
    const db = getDb();
    await expectDbError(
      db.$executeRaw`
        INSERT INTO audit_logs (action, meta)
        VALUES ('LOGIN_FAILED', ${JSON.stringify(meta)}::jsonb)
      `,
      { code: "23514", constraint: "audit_logs_login_failed_email_check" },
    );

    expect(
      (await db.auditLog.create({ data: { action: "LOGIN_FAILED", meta: { email: "x@y.test" } } }))
        .meta,
    ).toEqual({ email: "x@y.test" });
  });

  it("accepts LOGIN_FAILED with no company and no user", async () => {
    const audit = await getDb().auditLog.create({
      data: { action: "LOGIN_FAILED", meta: { email: "x@y.test" } },
    });

    expect(audit.companyId).toBeNull();
    expect(audit.userId).toBeNull();
    expect(audit.meta).toEqual({ email: "x@y.test" });
  });
});

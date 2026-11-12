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

import { randomUUID } from "node:crypto";
import { verify } from "@node-rs/argon2";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getDb } from "@/server/db";
import { SEED_DATA, SEED_PASSWORD } from "../../../prisma/seed-data.ts";
import { runSeed } from "../../../prisma/run-seed.ts";
import { expectDbError } from "../support/db-fixtures";

const db = getDb();
const companyIds = SEED_DATA.companies.map((company) => company.id);
const userEmails = SEED_DATA.users.map((user) => user.email);
const unitIds = SEED_DATA.units.map((unit) => unit.id);
const clientIds = SEED_DATA.clients.map((client) => client.id);

beforeAll(async () => {
  await runSeed(db);
});
afterAll(async () => {
  await db.$disconnect();
});

async function counts() {
  return Promise.all([
    db.company.count(),
    db.user.count(),
    db.session.count(),
    db.unit.count(),
    db.client.count(),
    db.reservation.count(),
    db.contract.count(),
    db.installment.count(),
    db.payment.count(),
    db.auditLog.count(),
  ]);
}

describe("seed", () => {
  it("creates 2 companies with 1 manager, 1 accountant, 2 sales reps each", async () => {
    expect(await db.company.count({ where: { id: { in: companyIds } } })).toBe(2);
    const users = await db.user.findMany({ where: { email: { in: userEmails } } });
    expect(users).toHaveLength(8);
    for (const companyId of companyIds) {
      expect(
        users
          .filter((user) => user.companyId === companyId)
          .map((user) => user.role)
          .sort(),
      ).toEqual(["ACCOUNTANT", "MANAGER", "SALES", "SALES"]);
    }
  });

  it("each company has ≥10 available units", async () => {
    for (const companyId of companyIds) {
      const units = await db.unit.findMany({ where: { companyId, id: { in: unitIds } } });
      expect(units.length).toBeGreaterThanOrEqual(10);
      expect(units.every((unit) => unit.status === "AVAILABLE")).toBe(true);
      expect(units.every((unit) => typeof unit.price === "bigint")).toBe(true);
    }
  });

  it("each sales rep has ≥3 clients in the same company", async () => {
    for (const rep of SEED_DATA.users.filter((user) => user.role === "SALES")) {
      const clients = await db.client.findMany({
        where: { salesRepId: rep.id, id: { in: clientIds } },
      });
      expect(clients.length).toBeGreaterThanOrEqual(3);
      expect(clients.every((client) => client.companyId === rep.companyId)).toBe(true);
    }
  });

  it("every seed password hash starts with `$argon2id$` and verifies with the README password", async () => {
    const users = await db.user.findMany({ where: { email: { in: userEmails } } });
    expect(users).toHaveLength(8);
    expect(SEED_PASSWORD).toBe("AqarLite#2026");
    for (const user of users) {
      expect(user.passwordHash).toMatch(/^\$argon2id\$/);
      expect(await verify(user.passwordHash, "AqarLite#2026")).toBe(true);
    }
  });

  it("seed creates no reservations, contracts, installments, payments or audit rows for seed companies", async () => {
    const where = { companyId: { in: companyIds } };
    expect(await db.reservation.count({ where })).toBe(0);
    expect(await db.contract.count({ where })).toBe(0);
    expect(await db.installment.count({ where: { contract: where } })).toBe(0);
    expect(await db.payment.count({ where: { contract: where } })).toBe(0);
    expect(await db.auditLog.count({ where })).toBe(0);
  });

  it("a second run changes no row count in any table", async () => {
    const before = await counts();
    await runSeed(db);
    expect(await counts()).toEqual(before);
  });

  it("a seed that fails midway leaves no rows", async () => {
    const ids = new Map(
      [...SEED_DATA.companies, ...SEED_DATA.users, ...SEED_DATA.units, ...SEED_DATA.clients].map(
        (row) => [row.id, randomUUID()],
      ),
    );
    function fresh(id: string): string {
      const value = ids.get(id);
      if (!value) throw new Error(`Missing copied id: ${id}`);
      return value;
    }
    const copy = {
      companies: SEED_DATA.companies.map((row) => ({ ...row, id: fresh(row.id) })),
      users: SEED_DATA.users.map((row) => ({
        ...row,
        id: fresh(row.id),
        companyId: fresh(row.companyId),
        email: `${fresh(row.id)}@seed.test`,
      })),
      units: SEED_DATA.units.map((row) => ({
        ...row,
        id: fresh(row.id),
        companyId: fresh(row.companyId),
      })),
      clients: SEED_DATA.clients.map((row) => ({
        ...row,
        id: fresh(row.id),
        companyId: fresh(row.companyId),
        salesRepId: fresh(row.salesRepId),
      })),
    };
    const lastUnit = copy.units.at(-1);
    if (!lastUnit) throw new Error("Expected seed units");
    const validPrice = lastUnit.price;
    lastUnit.price = 0n;
    await expectDbError(runSeed(db, copy), { code: "23514", constraint: "units_price_check" });
    async function copiedCounts() {
      return Promise.all([
        db.company.count({ where: { id: { in: copy.companies.map((row) => row.id) } } }),
        db.user.count({ where: { id: { in: copy.users.map((row) => row.id) } } }),
        db.unit.count({ where: { id: { in: copy.units.map((row) => row.id) } } }),
        db.client.count({ where: { id: { in: copy.clients.map((row) => row.id) } } }),
      ]);
    }
    expect(await copiedCounts()).toEqual([0, 0, 0, 0]);
    lastUnit.price = validPrice;
    await runSeed(db, copy);
    expect(await copiedCounts()).toEqual([
      copy.companies.length,
      copy.users.length,
      copy.units.length,
      copy.clients.length,
    ]);
  });
});

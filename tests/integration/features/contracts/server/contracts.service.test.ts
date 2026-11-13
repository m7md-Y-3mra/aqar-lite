import { beforeEach, describe, expect, it } from "vitest";

import { buildSchedule } from "@/features/contracts/domain/schedule";
import { minFinalPrice } from "@/features/contracts/domain/pricing";
import { dbNow } from "@/features/contracts/server/contracts.repository";
import {
  getContract,
  getContractOptions,
  listContracts,
} from "@/features/contracts/server/contracts.service";
import type { SessionUser } from "@/server/auth/session.service";
import { getDb } from "@/server/db";
import { toRiyadhDate } from "@/shared/lib/dates";
import {
  makeClient,
  makeContract,
  makeInstallment,
  makeReservation,
  makeUnit,
} from "../../../support/db-fixtures";
import { makeTwoCompanies } from "../../../support/session-users";

let companies: Awaited<ReturnType<typeof makeTwoCompanies>>;
const query = { page: 1, pageSize: 20 };

beforeEach(async () => {
  companies = await makeTwoCompanies();
});

async function fixture(owner: SessionUser = companies.a.sales1, approvedAt: Date | null = null) {
  const unit = await makeUnit(owner.companyId, { status: approvedAt ? "SOLD" : "RESERVED" });
  const client = await makeClient(owner.companyId, owner.userId);
  const reservation = await makeReservation({
    companyId: owner.companyId,
    unitId: unit.id,
    clientId: client.id,
    salesRepId: owner.userId,
  });
  const contract = await makeContract(owner.companyId, reservation.id, { approvedAt });
  return { ...contract, unit, client, reservation, owner };
}

async function expire(reservationId: string) {
  await getDb().reservation.update({
    where: { id: reservationId },
    data: { expiresAt: new Date((await dbNow()).getTime() - 60_000) },
  });
}

describe("list", () => {
  it("accountant and manager see all reps' contracts", async () => {
    const rows = [await fixture(), await fixture(companies.a.sales2)];
    for (const user of [companies.a.manager, companies.a.accountant]) {
      const page = await listContracts(user, query);
      expect(page.items.map(({ id }) => id).sort()).toEqual(rows.map(({ id }) => id).sort());
      expect(page.total).toBe(2);
    }
  });

  it("rep sees only own", async () => {
    const own = await fixture();
    await fixture(companies.a.sales2);
    expect(await listContracts(companies.a.sales1, query)).toMatchObject({
      items: [{ id: own.id }],
      total: 1,
    });
  });

  it("item has unit, client, salesRep, finalPrice, remaining, status", async () => {
    const row = await fixture();
    const page = await listContracts(companies.a.manager, query);
    expect(page.items).toEqual([
      {
        id: row.id,
        status: "DRAFT",
        reservationExpired: false,
        unit: { id: row.unit.id, projectName: row.unit.projectName, number: row.unit.number },
        client: { id: row.client.id, name: row.client.name },
        salesRep: { id: row.owner.userId, name: row.owner.name },
        finalPrice: Number(row.finalPrice),
        remaining: Number(row.finalPrice),
        approvedAt: null,
      },
    ]);
    expect(JSON.parse(JSON.stringify(page))).toEqual(page);
  });

  it("draft with expired reservation has reservationExpired true", async () => {
    const row = await fixture();
    await expire(row.reservationId);
    expect((await listContracts(companies.a.manager, query)).items[0]?.reservationExpired).toBe(
      true,
    );
  });

  it("approved never has reservationExpired", async () => {
    const row = await fixture(companies.a.sales1, await dbNow());
    await expire(row.reservationId);
    expect((await listContracts(companies.a.manager, query)).items[0]?.reservationExpired).toBe(
      false,
    );
    expect((await getContract(companies.a.manager, row.id)).reservationExpired).toBe(false);
  });

  it("drafts first, then newest approval, id breaks ties; pages never repeat or skip", async () => {
    const older = await fixture(companies.a.sales1, new Date("2026-01-01T00:00:00Z"));
    const tied = [
      await fixture(companies.a.sales1, new Date("2026-02-01T00:00:00Z")),
      await fixture(companies.a.sales2, new Date("2026-02-01T00:00:00Z")),
    ];
    const drafts = [await fixture(), await fixture(companies.a.sales2)];
    const ids: string[] = [];
    for (let page = 1; page <= 3; page++) {
      const result = await listContracts(companies.a.manager, { page, pageSize: 2 });
      expect(result).toMatchObject({ total: 5, page, pageSize: 2 });
      ids.push(...result.items.map(({ id }) => id));
    }
    expect(ids).toEqual([
      ...drafts.map(({ id }) => id).sort(),
      ...tied.map(({ id }) => id).sort(),
      older.id,
    ]);
    expect(new Set(ids).size).toBe(5);
  });

  it("remaining per row", async () => {
    const draft = await fixture();
    const first = await fixture(companies.a.sales1, await dbNow());
    const second = await fixture(companies.a.sales2, await dbNow());
    await makeInstallment(first.id, { paidAmount: 100n });
    await makeInstallment(first.id, { seq: 2, paidAmount: 200n });
    await makeInstallment(second.id, { paidAmount: 500n });
    const page = await listContracts(companies.a.accountant, query);
    const remaining = new Map(page.items.map((row) => [row.id, row.remaining]));
    expect(remaining.get(draft.id)).toBe(Number(draft.finalPrice));
    expect(remaining.get(first.id)).toBe(Number(first.finalPrice) - 300);
    expect(remaining.get(second.id)).toBe(Number(second.finalPrice) - 500);
  });
});

describe("detail", () => {
  it("rep opening another rep's contract → NOT_FOUND", async () => {
    const row = await fixture(companies.a.sales2);
    await expect(getContract(companies.a.sales1, row.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("has unit with price, client, salesRep, reservation expiresAt, terms, startDate, remaining, today", async () => {
    const approvedAt = new Date("2027-01-30T22:00:00Z");
    const row = await fixture(companies.a.sales1, approvedAt);
    const before = toRiyadhDate(await dbNow());
    const dto = await getContract(companies.a.accountant, row.id);
    const after = toRiyadhDate(await dbNow());
    expect([before, after]).toContain(dto.today);
    expect(dto).toMatchObject({
      id: row.id,
      status: "APPROVED",
      reservationExpired: false,
      unit: { id: row.unit.id, price: Number(row.unit.price) },
      client: { id: row.client.id, name: row.client.name },
      salesRep: { id: row.owner.userId, name: row.owner.name },
      reservation: { id: row.reservationId, expiresAt: row.reservation.expiresAt.toISOString() },
      finalPrice: Number(row.finalPrice),
      downPayment: 0,
      installmentCount: 10,
      minFinalPrice: minFinalPrice(Number(row.unit.price)),
      startDate: "2027-01-31",
      remaining: Number(row.finalPrice),
      approvedAt: approvedAt.toISOString(),
    });
    expect(JSON.parse(JSON.stringify(dto))).toEqual(dto);
  });

  it("draft schedule equals buildSchedule(terms, today) with estimated true", async () => {
    const row = await fixture();
    const dto = await getContract(companies.a.sales1, row.id);
    expect(dto.startDate).toBeNull();
    expect(dto.schedule).toEqual({
      estimated: true,
      lines: buildSchedule(
        {
          finalPrice: Number(row.finalPrice),
          downPayment: Number(row.downPayment),
          installmentCount: row.installmentCount,
        },
        dto.today,
      ),
    });
    expect(dto.schedule.lines.every((line) => !("paidAmount" in line) && !("status" in line))).toBe(
      true,
    );
  });

  it("approved schedule is the stored rows with estimated false", async () => {
    const row = await fixture(companies.a.sales1, await dbNow());
    const second = await makeInstallment(row.id, {
      seq: 2,
      dueDate: new Date("2030-03-31T00:00:00Z"),
      amount: 200n,
    });
    const first = await makeInstallment(row.id, {
      seq: 1,
      dueDate: new Date("2030-02-28T00:00:00Z"),
      amount: 100n,
    });
    const dto = await getContract(companies.a.manager, row.id);
    expect(dto.schedule.estimated).toBe(false);
    expect(
      dto.schedule.lines.map(({ seq, dueDate, amount }) => ({ seq, dueDate, amount })),
    ).toEqual(
      [first, second].map((line) => ({
        seq: line.seq,
        dueDate: line.dueDate.toISOString().slice(0, 10),
        amount: Number(line.amount),
      })),
    );
  });

  it("statuses from paid amounts set in the DB", async () => {
    const row = await fixture(companies.a.sales1, await dbNow());
    const today = toRiyadhDate(await dbNow());
    const cases = [
      { seq: 0, dueDate: "2000-01-01", paidAmount: 100n, status: "PAID" },
      { seq: 1, dueDate: "2000-01-01", paidAmount: 0n, status: "OVERDUE" },
      { seq: 2, dueDate: "2000-01-01", paidAmount: 50n, status: "OVERDUE" },
      { seq: 3, dueDate: today, paidAmount: 50n, status: "PARTIAL" },
      { seq: 4, dueDate: today, paidAmount: 0n, status: "UNPAID" },
    ];
    for (const line of cases) {
      const stored = await makeInstallment(row.id, {
        seq: line.seq,
        dueDate: new Date(`${line.dueDate}T00:00:00Z`),
        amount: 100n,
      });
      await getDb().installment.update({
        where: { id: stored.id },
        data: { paidAmount: line.paidAmount },
      });
    }
    expect(
      (await getContract(companies.a.accountant, row.id)).schedule.lines.map((line) =>
        "status" in line ? line.status : null,
      ),
    ).toEqual(cases.map(({ status }) => status));
  });

  it("remaining after setting paid amounts", async () => {
    const row = await fixture(companies.a.sales1, await dbNow());
    const line = await makeInstallment(row.id);
    await getDb().installment.update({ where: { id: line.id }, data: { paidAmount: 123n } });
    expect((await getContract(companies.a.accountant, row.id)).remaining).toBe(
      Number(row.finalPrice) - 123,
    );
  });
});

describe("options", () => {
  it("rep gets own reservation with minFinalPrice and today", async () => {
    const row = await fixture();
    const dto = await getContractOptions(companies.a.sales1, row.reservationId);
    expect(dto).toEqual({
      reservation: { id: row.reservationId, expiresAt: row.reservation.expiresAt.toISOString() },
      unit: {
        id: row.unit.id,
        projectName: row.unit.projectName,
        number: row.unit.number,
        price: Number(row.unit.price),
      },
      client: { id: row.client.id, name: row.client.name },
      minFinalPrice: minFinalPrice(Number(row.unit.price)),
      today: toRiyadhDate(await dbNow()),
      contractId: row.id,
    });
    expect(JSON.parse(JSON.stringify(dto))).toEqual(dto);
  });

  it("MANAGER and ACCOUNTANT → FORBIDDEN", async () => {
    const row = await fixture();
    for (const user of [companies.a.manager, companies.a.accountant]) {
      await expect(getContractOptions(user, row.reservationId)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    }
  });

  it("another rep's reservation → NOT_FOUND", async () => {
    const row = await fixture(companies.a.sales2);
    await expect(getContractOptions(companies.a.sales1, row.reservationId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("expired reservation without a contract still returns options", async () => {
    const unit = await makeUnit(companies.a.companyId);
    const client = await makeClient(companies.a.companyId, companies.a.sales1.userId);
    const reservation = await makeReservation({
      companyId: companies.a.companyId,
      unitId: unit.id,
      clientId: client.id,
      salesRepId: companies.a.sales1.userId,
    });
    await expire(reservation.id);
    const dto = await getContractOptions(companies.a.sales1, reservation.id);
    expect(dto.contractId).toBeNull();
    expect(new Date(dto.reservation.expiresAt).getTime()).toBeLessThan((await dbNow()).getTime());
  });
});

describe("tenant isolation", () => {
  it("accountant/manager of A never list B's contracts", async () => {
    const own = await fixture();
    await fixture(companies.b.sales1);
    for (const user of [companies.a.manager, companies.a.accountant]) {
      expect(await listContracts(user, query)).toMatchObject({ items: [{ id: own.id }], total: 1 });
    }
  });

  it("detail of B's contract from A → NOT_FOUND", async () => {
    const foreign = await fixture(companies.b.sales1);
    for (const user of [companies.a.manager, companies.a.accountant, companies.a.sales1]) {
      await expect(getContract(user, foreign.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
  });

  it("options of B's reservation from A → NOT_FOUND", async () => {
    const foreign = await fixture(companies.b.sales1);
    await expect(
      getContractOptions(companies.a.sales1, foreign.reservationId),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

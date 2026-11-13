import { beforeEach, describe, expect, it } from "vitest";

import { buildSchedule } from "@/features/contracts/domain/schedule";
import { minFinalPrice } from "@/features/contracts/domain/pricing";
import { dbNow } from "@/features/contracts/server/contracts.repository";
import {
  approveContract,
  createContract,
  updateContract,
  getContract,
  getContractOptions,
  listContracts,
} from "@/features/contracts/server/contracts.service";
import type { SessionUser } from "@/server/auth/session.service";
import { getDb } from "@/server/db";
import { listUnits } from "@/features/units/server";
import { unitListQuerySchema } from "@/features/units/units.schemas";
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

function terms(row: Awaited<ReturnType<typeof fixture>>) {
  return {
    finalPrice: Number(row.finalPrice),
    downPayment: Number(row.downPayment),
    installmentCount: row.installmentCount,
  };
}

async function approvalState(row: Awaited<ReturnType<typeof fixture>>) {
  const db = getDb();
  return {
    contract: await db.contract.findUniqueOrThrow({ where: { id: row.id } }),
    unit: await db.unit.findUniqueOrThrow({ where: { id: row.unit.id } }),
    lines: await db.installment.findMany({ where: { contractId: row.id }, orderBy: { seq: "asc" } }),
    audits: await db.auditLog.findMany({ where: { entityId: row.id, action: "CONTRACT_APPROVED" } }),
  };
}

async function expectUnapproved(row: Awaited<ReturnType<typeof fixture>>) {
  const state = await approvalState(row);
  expect(state.contract.approvedAt).toBeNull();
  expect(state.unit.status).toBe("RESERVED");
  expect(state.lines).toHaveLength(0);
  expect(state.audits).toHaveLength(0);
}

describe("approve", () => {
  it("success: approvedAt set, unit SOLD, lines stored, one CONTRACT_APPROVED audit row with unitPrice and finalPrice", async () => {
    const row = await fixture();
    await getDb().contract.update({ where: { id: row.id }, data: { downPayment: 100_000n } });
    const input = { ...terms(row), downPayment: 100_000 };
    const dto = await approveContract(companies.a.accountant, row.id, input);
    const state = await approvalState(row);
    expect(dto.status).toBe("APPROVED");
    expect(dto.schedule.estimated).toBe(false);
    expect(state.contract.approvedAt).not.toBeNull();
    expect(state.unit.status).toBe("SOLD");
    expect(state.lines).toHaveLength(input.installmentCount + 1);
    expect(state.audits).toHaveLength(1);
    expect(state.audits[0]).toMatchObject({
      companyId: companies.a.companyId, userId: companies.a.accountant.userId,
      createdAt: state.contract.approvedAt,
      meta: { unitId: row.unit.id, unitPrice: Number(row.unit.price), ...input, startDate: dto.startDate },
    });
  });

  it("stored lines sum to finalPrice", async () => {
    const row = await fixture();
    await approveContract(companies.a.accountant, row.id, terms(row));
    const { lines } = await approvalState(row);
    expect(lines.reduce((sum, line) => sum + line.amount, 0n)).toBe(row.finalPrice);
  });

  it("stored due dates equal buildSchedule(terms, startDate)", async () => {
    const row = await fixture();
    const dto = await approveContract(companies.a.accountant, row.id, terms(row));
    const { lines } = await approvalState(row);
    expect(lines.map((line) => ({ seq: line.seq, dueDate: line.dueDate.toISOString().slice(0, 10), amount: Number(line.amount) })))
      .toEqual(buildSchedule(terms(row), dto.startDate!));
  });

  it("down payment 0 stores no seq 0", async () => {
    const row = await fixture();
    await approveContract(companies.a.accountant, row.id, terms(row));
    const { lines } = await approvalState(row);
    expect(lines).toHaveLength(row.installmentCount);
    expect(lines.some((line) => line.seq === 0)).toBe(false);
  });

  it("all-or-nothing: forced failure on the audit insert leaves draft, RESERVED unit, 0 installments, 0 audit rows", async () => {
    const row = await fixture();
    const db = getDb();
    try {
      await db.$executeRawUnsafe(`CREATE FUNCTION test_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced failure'; END; $$`);
      await db.$executeRawUnsafe(`CREATE TRIGGER test_fail_audit BEFORE INSERT ON audit_logs FOR EACH ROW WHEN (NEW.action = 'CONTRACT_APPROVED' AND NEW.entity_id = '${row.id}') EXECUTE FUNCTION test_fail_audit()`);
      await expect(approveContract(companies.a.accountant, row.id, terms(row))).rejects.toThrow();
      await expectUnapproved(row);
    } finally {
      await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS test_fail_audit ON audit_logs');
      await db.$executeRawUnsafe('DROP FUNCTION IF EXISTS test_fail_audit()');
    }
  });

  for (const field of ["finalPrice", "downPayment", "installmentCount"] as const) {
    it(`different ${field} → CONTRACT_CHANGED, still a draft`, async () => {
      const row = await fixture();
      const input = terms(row);
      input[field] += 1;
      await expect(approveContract(companies.a.accountant, row.id, input)).rejects.toMatchObject({ code: "CONTRACT_CHANGED" });
      await expectUnapproved(row);
    });
  }

  it("expired reservation → RESERVATION_EXPIRED, unit not SOLD, no installments, no audit row", async () => {
    const row = await fixture();
    await expire(row.reservationId);
    await expect(approveContract(companies.a.accountant, row.id, terms(row))).rejects.toMatchObject({ code: "RESERVATION_EXPIRED" });
    await expectUnapproved(row);
  });

  it("non-RESERVED unit → RESERVATION_EXPIRED", async () => {
    const row = await fixture();
    await getDb().unit.update({ where: { id: row.unit.id }, data: { status: "AVAILABLE" } });
    await expect(approveContract(companies.a.accountant, row.id, terms(row))).rejects.toMatchObject({ code: "RESERVATION_EXPIRED" });
    const state = await approvalState(row);
    expect(state.contract.approvedAt).toBeNull();
    expect(state.lines).toHaveLength(0);
    expect(state.audits).toHaveLength(0);
  });

  it("approving twice → CONTRACT_ALREADY_APPROVED", async () => {
    const row = await fixture();
    await approveContract(companies.a.accountant, row.id, terms(row));
    await expect(approveContract(companies.a.accountant, row.id, terms(row))).rejects.toMatchObject({ code: "CONTRACT_ALREADY_APPROVED" });
  });

  it("unit stays SOLD after the reservation's expiry passes", async () => {
    const row = await fixture();
    await approveContract(companies.a.accountant, row.id, terms(row));
    await expire(row.reservationId);
    await listUnits(companies.a.manager, unitListQuerySchema.parse({ page: "1", pageSize: "20", order: "asc" }));
    expect((await approvalState(row)).unit.status).toBe("SOLD");
  });
});

describe("mutation role checks", () => {
  for (const role of ["manager", "accountant"] as const) {
    it(`${role.toUpperCase()} cannot create or edit`, async () => {
      const row = await fixture();
      await expect(createContract(companies.a[role], { reservationId: row.reservationId, ...terms(row) })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(updateContract(companies.a[role], row.id, terms(row))).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  }
  for (const role of ["manager", "sales1"] as const) {
    it(`${role.toUpperCase()} cannot approve`, async () => {
      const row = await fixture();
      await expect(approveContract(companies.a[role], row.id, terms(row))).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expectUnapproved(row);
    });
  }
});

describe("mutation tenant isolation and ownership", () => {
  it("accountant of B approving A's contract → NOT_FOUND, nothing changes", async () => {
    const row = await fixture();
    await expect(approveContract(companies.b.accountant, row.id, terms(row))).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expectUnapproved(row);
  });
  it("rep cannot create or edit another rep's or company's reservation/contract", async () => {
    for (const owner of [companies.a.sales2, companies.b.sales1]) {
      const row = await fixture(owner);
      await expect(createContract(companies.a.sales1, { reservationId: row.reservationId, ...terms(row) })).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(updateContract(companies.a.sales1, row.id, terms(row))).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
  });
});

describe("concurrency", () => {
  it("two parallel approvals: one wins, one set of installments, one audit row (×10)", async () => {
    for (let i = 0; i < 10; i++) {
      const row = await fixture();
      const results = await Promise.allSettled([
        approveContract(companies.a.accountant, row.id, terms(row)),
        approveContract(companies.a.accountant, row.id, terms(row)),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const rejected = results.find((r) => r.status === "rejected");
      expect(rejected?.reason).toMatchObject({ code: "CONTRACT_ALREADY_APPROVED" });
      const state = await approvalState(row);
      expect(state.lines).toHaveLength(row.installmentCount);
      expect(state.audits).toHaveLength(1);
    }
  });
});

async function reservationFixture(owner = companies.a.sales1) {
  const unit = await makeUnit(owner.companyId, { status: "RESERVED" });
  const client = await makeClient(owner.companyId, owner.userId);
  const reservation = await makeReservation({
    companyId: owner.companyId, unitId: unit.id, clientId: client.id, salesRepId: owner.userId,
  });
  return { reservation, unit, owner, input: { reservationId: reservation.id, finalPrice: Number(unit.price), downPayment: 100_000, installmentCount: 3 } };
}

describe("create", () => {
  it("rep creates a draft from own active reservation, unit stays RESERVED, 0 installments and audit rows", async () => {
    const row = await reservationFixture();
    const dto = await createContract(row.owner, row.input);
    expect(dto).toMatchObject({ status: "DRAFT", finalPrice: row.input.finalPrice, downPayment: row.input.downPayment, installmentCount: row.input.installmentCount, schedule: { estimated: true } });
    expect(dto.reservation.id).toBe(row.reservation.id);
    expect(dto.schedule.lines).toEqual(buildSchedule(row.input, dto.today));
    expect(JSON.parse(JSON.stringify(dto))).toEqual(dto);
    expect((await getDb().unit.findUniqueOrThrow({ where: { id: row.unit.id } })).status).toBe("RESERVED");
    expect(await getDb().installment.count({ where: { contractId: dto.id } })).toBe(0);
    expect(await getDb().auditLog.count({ where: { entityId: dto.id } })).toBe(0);
  });

  it("below 95% → VALIDATION_ERROR with fieldErrors.finalPrice and minimum in riyals", async () => {
    const row = await reservationFixture();
    await expect(createContract(row.owner, { ...row.input, finalPrice: minFinalPrice(Number(row.unit.price)) - 1 })).rejects.toMatchObject({
      code: "VALIDATION_ERROR", fieldErrors: { finalPrice: [expect.stringContaining("ريال")] },
    });
    expect(await getDb().contract.count({ where: { reservationId: row.reservation.id } })).toBe(0);
  });

  it("exactly 95% succeeds", async () => {
    const row = await reservationFixture();
    const finalPrice = minFinalPrice(Number(row.unit.price));
    expect((await createContract(row.owner, { ...row.input, finalPrice })).finalPrice).toBe(finalPrice);
  });

  it("expired reservation → RESERVATION_EXPIRED", async () => {
    const row = await reservationFixture();
    await expire(row.reservation.id);
    await expect(createContract(row.owner, row.input)).rejects.toMatchObject({ code: "RESERVATION_EXPIRED" });
  });

  it("reservation already has a contract → CONTRACT_EXISTS", async () => {
    const row = await fixture();
    await expect(createContract(row.owner, { reservationId: row.reservationId, ...terms(row) })).rejects.toMatchObject({ code: "CONTRACT_EXISTS" });
  });

  it("two parallel creates: one wins, one CONTRACT_EXISTS", async () => {
    const row = await reservationFixture();
    const results = await Promise.allSettled([
      createContract(row.owner, row.input), createContract(row.owner, row.input),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")?.reason).toMatchObject({ code: "CONTRACT_EXISTS" });
    expect(await getDb().contract.count({ where: { reservationId: row.reservation.id } })).toBe(1);
  });
});

describe("edit", () => {
  it("rep edits own draft", async () => {
    const row = await fixture();
    const input = { ...terms(row), finalPrice: Number(row.finalPrice) + 123, downPayment: 100_000, installmentCount: 3 };
    const dto = await updateContract(row.owner, row.id, input);
    expect(dto).toMatchObject({ ...input, status: "DRAFT", schedule: { estimated: true } });
    expect(dto.schedule.lines).toEqual(buildSchedule(input, dto.today));
    await expectUnapproved(row);
  });

  it("approved contract → CONTRACT_ALREADY_APPROVED, values unchanged", async () => {
    const row = await fixture();
    await approveContract(companies.a.accountant, row.id, terms(row));
    const before = await approvalState(row);
    await expect(updateContract(row.owner, row.id, { ...terms(row), finalPrice: Number(row.finalPrice) + 100 })).rejects.toMatchObject({ code: "CONTRACT_ALREADY_APPROVED" });
    expect(await approvalState(row)).toEqual(before);
  });

  it("expired reservation → RESERVATION_EXPIRED, values unchanged", async () => {
    const row = await fixture();
    await expire(row.reservationId);
    const before = await approvalState(row);
    await expect(updateContract(row.owner, row.id, { ...terms(row), finalPrice: Number(row.finalPrice) + 100 })).rejects.toMatchObject({ code: "RESERVATION_EXPIRED" });
    expect(await approvalState(row)).toEqual(before);
  });

  it("below minimum → VALIDATION_ERROR, values unchanged", async () => {
    const row = await fixture();
    await expect(updateContract(row.owner, row.id, { ...terms(row), finalPrice: minFinalPrice(Number(row.unit.price)) - 1 })).rejects.toMatchObject({ code: "VALIDATION_ERROR", fieldErrors: { finalPrice: expect.any(Array) } });
    expect((await approvalState(row)).contract.finalPrice).toBe(row.finalPrice);
  });

  it("edit vs approve never both succeed (×10)", async () => {
    for (let i = 0; i < 10; i++) {
      const row = await fixture();
      const old = terms(row);
      const edited = { ...old, finalPrice: old.finalPrice + 100 };
      const [edit, approval] = await Promise.allSettled([
        updateContract(row.owner, row.id, edited), approveContract(companies.a.accountant, row.id, old),
      ]);
      expect([edit, approval].filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const state = await approvalState(row);
      if (edit.status === "fulfilled") {
        expect(approval.status).toBe("rejected");
        if (approval.status === "rejected") expect(approval.reason).toMatchObject({ code: "CONTRACT_CHANGED" });
        expect(state.contract.finalPrice).toBe(BigInt(edited.finalPrice));
        await expectUnapproved(row);
      } else {
        expect(edit.reason).toMatchObject({ code: "CONTRACT_ALREADY_APPROVED" });
        expect(state.contract.finalPrice).toBe(row.finalPrice);
        expect(state.contract.approvedAt).not.toBeNull();
        expect(state.unit.status).toBe("SOLD");
        expect(state.lines).toHaveLength(old.installmentCount);
        expect(state.audits).toHaveLength(1);
      }
    }
  });
});

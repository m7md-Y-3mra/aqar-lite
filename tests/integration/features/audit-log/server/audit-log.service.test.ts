import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";

import { listAuditLog } from "@/features/audit-log/server/audit-log.service";
import { login } from "@/features/auth/server/auth.service";
import { approveContract } from "@/features/contracts/server/contracts.service";
import { recordPayment } from "@/features/payments/server/payments.service";
import { updateUnit } from "@/features/units/server/units.service";
import { getDb } from "@/server/db";
import { AppError } from "@/server/http/app-error";
import { makeUnit, makeUserWithPassword } from "../../../support/db-fixtures";
import { makeTwoCompanies } from "../../../support/session-users";
import { makeDraftContract } from "../../payments/server/payments-fixtures";

let companies: Awaited<ReturnType<typeof makeTwoCompanies>>;

beforeEach(async () => {
  companies = await makeTwoCompanies();
});

function insertPriceEvent(companyId: string, userId: string, createdAt: Date) {
  return getDb().auditLog.create({
    data: {
      companyId,
      userId,
      action: "PRICE_CHANGED",
      entityId: randomUUID(),
      meta: { oldPrice: 10_000_000, newPrice: 11_000_000 },
      createdAt,
    },
  });
}

const query = { page: 1, pageSize: 20 };

describe("listAuditLog", () => {
  it("isolates both companies and excludes null-company failed logins", async () => {
    const { a, b } = companies;
    const time = new Date("2026-01-01T00:00:00.000Z");
    const own = await insertPriceEvent(a.companyId, a.manager.userId, time);
    const foreign = await insertPriceEvent(b.companyId, b.manager.userId, time);
    await getDb().auditLog.create({
      data: {
        companyId: null,
        userId: null,
        action: "LOGIN_FAILED",
        entityId: null,
        meta: { email: "unknown@example.test", reason: "invalid_credentials" },
        createdAt: time,
      },
    });

    expect((await listAuditLog(a.manager, query)).items.map(({ id }) => id)).toEqual([own.id]);
    expect((await listAuditLog(b.manager, query)).items.map(({ id }) => id)).toEqual([foreign.id]);
    expect((await listAuditLog(a.manager, query)).total).toBe(1);
    expect((await listAuditLog(b.manager, query)).total).toBe(1);
  });

  it("orders newest first, paginates, and counts all company rows", async () => {
    const { a } = companies;
    const rows = [];
    for (let day = 1; day <= 5; day++) {
      rows.push(
        await insertPriceEvent(a.companyId, a.manager.userId, new Date(Date.UTC(2026, 0, day))),
      );
    }
    const first = await listAuditLog(a.manager, { page: 1, pageSize: 2 });
    const second = await listAuditLog(a.manager, { page: 2, pageSize: 2 });
    expect(first.items.map(({ id }) => id)).toEqual([rows[4]!.id, rows[3]!.id]);
    expect(second.items.map(({ id }) => id)).toEqual([rows[2]!.id, rows[1]!.id]);
    expect(second).toMatchObject({ total: 5, page: 2, pageSize: 2 });
    expect(await listAuditLog(a.manager, { page: 4, pageSize: 2 })).toEqual({
      items: [],
      total: 5,
      page: 4,
      pageSize: 2,
    });
  });

  it("breaks timestamp ties by descending id without duplicate or missing pages", async () => {
    const { a } = companies;
    const time = new Date("2026-01-01T00:00:00.000Z");
    const rows = await Promise.all(
      Array.from({ length: 5 }, () => insertPriceEvent(a.companyId, a.manager.userId, time)),
    );
    const ids: string[] = [];
    for (let page = 1; page <= rows.length; page++) {
      const result = await listAuditLog(a.manager, { page, pageSize: 1 });
      expect(result.total).toBe(rows.length);
      ids.push(...result.items.map(({ id }) => id));
    }
    expect(ids).toEqual(
      rows
        .map(({ id }) => id)
        .sort()
        .reverse(),
    );
    expect(new Set(ids).size).toBe(rows.length);
  });

  it("returns the local actor name but hides foreign and missing actors", async () => {
    const { a, b } = companies;
    const time = new Date("2026-01-01T00:00:00.000Z");
    const local = await insertPriceEvent(a.companyId, a.manager.userId, time);
    const foreign = await insertPriceEvent(a.companyId, b.manager.userId, time);
    const missing = await getDb().auditLog.create({
      data: {
        companyId: a.companyId,
        userId: null,
        action: "PRICE_CHANGED",
        entityId: randomUUID(),
        meta: { oldPrice: 1, newPrice: 2 },
        createdAt: time,
      },
    });
    const { items } = await listAuditLog(a.manager, query);
    expect(items.find(({ id }) => id === local.id)?.actorName).toBe(a.manager.name);
    expect(items.find(({ id }) => id === foreign.id)?.actorName).toBeNull();
    expect(items.find(({ id }) => id === missing.id)?.actorName).toBeNull();
  });

  it.each(["sales1", "accountant"] as const)("rejects %s with FORBIDDEN", async (role) => {
    await expect(listAuditLog(companies.a[role], query)).rejects.toBeInstanceOf(AppError);
    await expect(listAuditLog(companies.a[role], query)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("parses all four real writers without meta-shape drift", async () => {
    const { a } = companies;
    const { email } = await makeUserWithPassword(a.companyId, "Correct#Pass1", "SALES");
    await expect(login({ email, password: "wrong-password" })).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
    const unit = await makeUnit(a.companyId);
    await updateUnit(a.manager, unit.id, {
      projectName: unit.projectName,
      number: unit.number,
      type: unit.type,
      area: unit.area,
      rooms: unit.rooms,
      price: 11_000_000,
    });
    const draft = await makeDraftContract(a.sales1);
    const approved = await approveContract(a.accountant, draft.id, {
      finalPrice: 10_000_000,
      downPayment: 0,
      installmentCount: 10,
    });
    await recordPayment(a.accountant, draft.id, { amount: 500_000 }, randomUUID());

    const result = await listAuditLog(a.manager, { page: 1, pageSize: 50 });
    expect(result.total).toBe(4);
    expect(result.items).toHaveLength(4);
    expect(result.items.every(({ details }) => details !== null)).toBe(true);
    const byAction = new Map(result.items.map((event) => [event.action, event]));
    expect(byAction.get("LOGIN_FAILED")).toMatchObject({
      actorName: null,
      details: { email, reason: "invalid_credentials" },
    });
    expect(byAction.get("PRICE_CHANGED")?.details).toEqual({
      unitId: unit.id,
      oldPrice: 10_000_000,
      newPrice: 11_000_000,
    });
    expect(byAction.get("CONTRACT_APPROVED")?.details).toEqual({
      contractId: draft.id,
      unitPrice: 10_000_000,
      finalPrice: 10_000_000,
      downPayment: 0,
      installmentCount: 10,
      startDate: approved.startDate,
    });
    expect(byAction.get("PAYMENT_RECORDED")?.details).toEqual({
      contractId: draft.id,
      amount: 500_000,
      allocation: [{ seq: 1, applied: 500_000 }],
      remainingAfter: 9_500_000,
    });
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });
});

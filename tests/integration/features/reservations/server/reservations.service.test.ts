import { beforeEach, describe, expect, it } from "vitest";

import { reserveInputSchema } from "@/features/reservations/reservations.schemas";
import {
  getReserveOptions,
  reserveUnit,
} from "@/features/reservations/server/reservations.service";
import { dbNow } from "@/features/units/server/units.repository";
import { listUnits } from "@/features/units/server/units.service";
import { unitListQuerySchema } from "@/features/units/units.schemas";
import { getDb } from "@/server/db";
import { AppError } from "@/server/http/app-error";
import { makeClient, makeReservation, makeUnit } from "../../../support/db-fixtures";
import { makeTwoCompanies } from "../../../support/session-users";

let companies: Awaited<ReturnType<typeof makeTwoCompanies>>;

beforeEach(async () => {
  companies = await makeTwoCompanies();
});

async function ownInput() {
  const { companyId, sales1 } = companies.a;
  const unit = await makeUnit(companyId);
  const client = await makeClient(companyId, sales1.userId);
  return { unitId: unit.id, clientId: client.id };
}

async function unitState(unitId: string) {
  const unit = await getDb().unit.findUniqueOrThrow({ where: { id: unitId } });
  return {
    status: unit.status,
    reservations: await getDb().reservation.count({ where: { unitId } }),
  };
}

async function expectRefusal(unitId: string, operation: () => Promise<unknown>, code: string) {
  const before = await unitState(unitId);
  const result = operation();
  await expect(result).rejects.toBeInstanceOf(AppError);
  await expect(result).rejects.toMatchObject({ code });
  expect(await unitState(unitId)).toEqual(before);
}

async function expire(id: string) {
  await getDb().reservation.update({
    where: { id },
    data: { expiresAt: new Date((await dbNow()).getTime() - 60_000) },
  });
}

describe("reserve", () => {
  it("rep reserves an available unit for own client", async () => {
    const input = await ownInput();
    const unit = await getDb().unit.findUniqueOrThrow({ where: { id: input.unitId } });
    const client = await getDb().client.findUniqueOrThrow({ where: { id: input.clientId } });
    const dto = await reserveUnit(companies.a.sales1, input);
    expect(dto).toEqual({
      id: expect.any(String),
      expiresAt: expect.any(String),
      unit: { id: unit.id, projectName: unit.projectName, number: unit.number },
      client: { id: client.id, name: client.name },
      salesRep: { id: companies.a.sales1.userId, name: companies.a.sales1.name },
    });
    expect(JSON.parse(JSON.stringify(dto))).toEqual(dto);
    expect(new Date(dto.expiresAt).toISOString()).toBe(dto.expiresAt);
    expect(await unitState(unit.id)).toEqual({ status: "RESERVED", reservations: 1 });
    expect(await getDb().reservation.findUnique({ where: { id: dto.id } })).toMatchObject({
      companyId: companies.a.companyId,
      unitId: unit.id,
      clientId: client.id,
      salesRepId: companies.a.sales1.userId,
    });
  });

  it("expiresAt − 72 h lies between the DB times read just before and just after the call", async () => {
    const input = await ownInput();
    const before = await dbNow();
    const dto = await reserveUnit(companies.a.sales1, input);
    const after = await dbNow();
    const start = new Date(dto.expiresAt).getTime() - 72 * 60 * 60 * 1000;
    expect(start).toBeGreaterThanOrEqual(before.getTime());
    expect(start).toBeLessThanOrEqual(after.getTime());
  });

  it("ignores hand-sent expiresAt, salesRepId, companyId, status", async () => {
    const input = reserveInputSchema.parse({
      ...(await ownInput()),
      expiresAt: "2030-01-01",
      salesRepId: companies.a.sales2.userId,
      companyId: companies.b.companyId,
      status: "SOLD",
    });
    const before = await dbNow();
    const dto = await reserveUnit(companies.a.sales1, input);
    const after = await dbNow();
    const start = new Date(dto.expiresAt).getTime() - 72 * 60 * 60 * 1000;
    expect(start).toBeGreaterThanOrEqual(before.getTime());
    expect(start).toBeLessThanOrEqual(after.getTime());
    expect(await unitState(input.unitId)).toEqual({ status: "RESERVED", reservations: 1 });
    expect(await getDb().reservation.findUnique({ where: { id: dto.id } })).toMatchObject({
      companyId: companies.a.companyId,
      salesRepId: companies.a.sales1.userId,
    });
  });
});

describe("conflict", () => {
  it("reserved unit → UNIT_NOT_AVAILABLE, nothing changes", async () => {
    const input = await ownInput();
    await reserveUnit(companies.a.sales1, input);
    await expectRefusal(
      input.unitId,
      () => reserveUnit(companies.a.sales1, input),
      "UNIT_NOT_AVAILABLE",
    );
  });

  it("sold unit → UNIT_NOT_AVAILABLE", async () => {
    const input = await ownInput();
    await getDb().unit.update({ where: { id: input.unitId }, data: { status: "SOLD" } });
    await expectRefusal(
      input.unitId,
      () => reserveUnit(companies.a.sales1, input),
      "UNIT_NOT_AVAILABLE",
    );
  });
});

describe("concurrency", () => {
  it.each([
    { label: "available", expired: false },
    { label: "just-expired", expired: true },
  ])("two reps, one $label unit: exactly one wins", async ({ expired }) => {
    const { companyId, sales1, sales2 } = companies.a;
    const clients = await Promise.all([
      makeClient(companyId, sales1.userId),
      makeClient(companyId, sales2.userId),
    ]);
    for (let iteration = 0; iteration < 10; iteration += 1) {
      const unit = await makeUnit(companyId, { status: expired ? "RESERVED" : "AVAILABLE" });
      if (expired) {
        const old = await makeReservation({
          companyId,
          unitId: unit.id,
          clientId: clients[0].id,
          salesRepId: sales1.userId,
        });
        await expire(old.id);
      }
      const results = await Promise.allSettled([
        reserveUnit(sales1, { unitId: unit.id, clientId: clients[0].id }),
        reserveUnit(sales2, { unitId: unit.id, clientId: clients[1].id }),
      ]);
      const winners = results.filter((result) => result.status === "fulfilled");
      const losers = results.filter((result) => result.status === "rejected");
      expect(winners).toHaveLength(1);
      expect(losers).toHaveLength(1);
      expect(losers[0]!.reason).toBeInstanceOf(AppError);
      expect(losers[0]!.reason).toMatchObject({ code: "UNIT_NOT_AVAILABLE" });
      const winnerIndex = results.findIndex((result) => result.status === "fulfilled");
      expect(winners[0]!.value.client.id).toBe(clients[winnerIndex]!.id);
      expect(await unitState(unit.id)).toEqual({
        status: "RESERVED",
        reservations: expired ? 2 : 1,
      });
      const active = await getDb().reservation.findMany({
        where: { unitId: unit.id, expiresAt: { gt: await dbNow() } },
      });
      expect(active).toHaveLength(1);
      expect(active[0]).toMatchObject({
        id: winners[0]!.value.id,
        clientId: clients[winnerIndex]!.id,
        salesRepId: winnerIndex === 0 ? sales1.userId : sales2.userId,
      });
    }
  });
});

describe("ownership", () => {
  it("rep cannot reserve for another rep's client", async () => {
    const input = await ownInput();
    const client = await makeClient(companies.a.companyId, companies.a.sales2.userId);
    await expectRefusal(
      input.unitId,
      () => reserveUnit(companies.a.sales1, { ...input, clientId: client.id }),
      "NOT_FOUND",
    );
  });
});

describe("tenant isolation", () => {
  it("unit of company B → NOT_FOUND, B's unit unchanged", async () => {
    const input = await ownInput();
    const foreign = await makeUnit(companies.b.companyId);
    await expectRefusal(
      foreign.id,
      () => reserveUnit(companies.a.sales1, { ...input, unitId: foreign.id }),
      "NOT_FOUND",
    );
  });

  it("client of company B → NOT_FOUND", async () => {
    const input = await ownInput();
    const foreign = await makeClient(companies.b.companyId, companies.b.sales1.userId);
    await expectRefusal(
      input.unitId,
      () => reserveUnit(companies.a.sales1, { ...input, clientId: foreign.id }),
      "NOT_FOUND",
    );
  });
});

describe("role checks", () => {
  it.each(["manager", "accountant"] as const)("%s cannot reserve", async (role) => {
    const input = await ownInput();
    await expectRefusal(input.unitId, () => reserveUnit(companies.a[role], input), "FORBIDDEN");
  });
});

describe("options", () => {
  it("returns the unit and only the rep's own clients, by name", async () => {
    const { companyId, sales1, sales2 } = companies.a;
    const unit = await makeUnit(companyId);
    const last = await makeClient(companyId, sales1.userId, { name: "Z" });
    const first = await makeClient(companyId, sales1.userId, { name: "A" });
    await makeClient(companyId, sales2.userId);
    await makeClient(companies.b.companyId, companies.b.sales1.userId);
    expect(await getReserveOptions(sales1, unit.id)).toEqual({
      unit: {
        id: unit.id,
        projectName: unit.projectName,
        number: unit.number,
        status: "AVAILABLE",
      },
      clients: [
        { id: first.id, name: "A" },
        { id: last.id, name: "Z" },
      ],
    });
  });

  it.each(["manager", "accountant"] as const)("%s → FORBIDDEN", async (role) => {
    const unit = await makeUnit(companies.a.companyId);
    await expectRefusal(unit.id, () => getReserveOptions(companies.a[role], unit.id), "FORBIDDEN");
  });

  it("unit of company B → NOT_FOUND", async () => {
    const foreign = await makeUnit(companies.b.companyId);
    await expectRefusal(
      foreign.id,
      () => getReserveOptions(companies.a.sales1, foreign.id),
      "NOT_FOUND",
    );
  });

  it("answers within 2 s while another unit of the company has an expired reservation", async () => {
    const input = await ownInput();
    const expiredUnit = await makeUnit(companies.a.companyId, { status: "RESERVED" });
    const old = await makeReservation({
      companyId: companies.a.companyId,
      unitId: expiredUnit.id,
      clientId: input.clientId,
      salesRepId: companies.a.sales1.userId,
    });
    await expire(old.id);
    const start = performance.now();
    expect(await getReserveOptions(companies.a.sales1, input.unitId)).toMatchObject({
      unit: { id: input.unitId, status: "AVAILABLE" },
    });
    expect(performance.now() - start).toBeLessThan(2000);
    expect(await unitState(expiredUnit.id)).toEqual({ status: "AVAILABLE", reservations: 1 });
  });
});

describe("expiry", () => {
  it("expired reservation frees the unit and another rep can reserve it", async () => {
    const input = await ownInput();
    const first = await reserveUnit(companies.a.sales1, input);
    await expire(first.id);
    const page = await listUnits(companies.a.manager, unitListQuerySchema.parse({}));
    expect(page.items).toContainEqual(
      expect.objectContaining({
        id: input.unitId,
        status: "AVAILABLE",
        reservedUntil: null,
      }),
    );
    const client2 = await makeClient(companies.a.companyId, companies.a.sales2.userId);
    const before = await dbNow();
    const second = await reserveUnit(companies.a.sales2, {
      unitId: input.unitId,
      clientId: client2.id,
    });
    expect(second.id).not.toBe(first.id);
    expect(new Date(second.expiresAt).getTime()).toBeGreaterThan(before.getTime());
    expect(second.salesRep.id).toBe(companies.a.sales2.userId);
    expect(await unitState(input.unitId)).toEqual({ status: "RESERVED", reservations: 2 });
  });

  it("the expired reservation row still exists after the unit is re-reserved", async () => {
    const input = await ownInput();
    const first = await reserveUnit(companies.a.sales1, input);
    await expire(first.id);
    const historical = await getDb().reservation.findUniqueOrThrow({ where: { id: first.id } });
    const client2 = await makeClient(companies.a.companyId, companies.a.sales2.userId);
    const second = await reserveUnit(companies.a.sales2, {
      unitId: input.unitId,
      clientId: client2.id,
    });
    expect(second.id).not.toBe(first.id);
    expect(await getDb().reservation.findUnique({ where: { id: first.id } })).toEqual(historical);
    expect(await unitState(input.unitId)).toEqual({ status: "RESERVED", reservations: 2 });
  });

  it("a SOLD unit with an expired reservation stays SOLD and cannot be reserved", async () => {
    const input = await ownInput();
    const first = await reserveUnit(companies.a.sales1, input);
    await expire(first.id);
    await getDb().unit.update({ where: { id: input.unitId }, data: { status: "SOLD" } });
    await expectRefusal(
      input.unitId,
      () => reserveUnit(companies.a.sales1, input),
      "UNIT_NOT_AVAILABLE",
    );
  });
});

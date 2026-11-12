import { beforeEach, describe, expect, it } from "vitest";

import { getUnit, listUnits } from "@/features/units/server/units.service";
import { unitListQuerySchema } from "@/features/units/units.schemas";
import { getDb } from "@/server/db";
import { makeClient, makeReservation, makeUnit } from "../../../support/db-fixtures";
import { makeTwoCompanies } from "../../../support/session-users";

let companies: Awaited<ReturnType<typeof makeTwoCompanies>>;

beforeEach(async () => {
  companies = await makeTwoCompanies();
});

function list(input: Record<string, string> = {}) {
  return listUnits(companies.a.manager, unitListQuerySchema.parse(input));
}

async function reservedUnit(status: "RESERVED" | "SOLD", expired: boolean) {
  const { companyId, sales1 } = companies.a;
  const unit = await makeUnit(companyId, { status });
  const client = await makeClient(companyId, sales1.userId);
  const reservation = await makeReservation({
    companyId,
    unitId: unit.id,
    clientId: client.id,
    salesRepId: sales1.userId,
  });
  if (expired) {
    await getDb().reservation.update({
      where: { id: reservation.id },
      data: { expiresAt: new Date(Date.now() - 86_400_000) },
    });
  }
  return unit;
}

describe("list", () => {
  it("filters by status", async () => {
    await makeUnit(companies.a.companyId);
    const sold = await makeUnit(companies.a.companyId, { status: "SOLD" });
    const reserved = await reservedUnit("RESERVED", false);

    for (const unit of [sold, reserved]) {
      const page = await list({ status: unit.status });
      expect(page.total).toBe(1);
      expect(page.items.map((item) => item.id)).toEqual([unit.id]);
      expect(page.items[0]?.status).toBe(unit.status);
    }
    const available = await list({ status: "AVAILABLE" });
    expect(available.total).toBe(1);
    expect(available.items[0]?.status).toBe("AVAILABLE");
  });

  it("price range includes both ends", async () => {
    const units = await Promise.all(
      [99n, 100n, 150n, 200n, 201n].map((price) => makeUnit(companies.a.companyId, { price })),
    );
    const page = await list({ minPrice: "100", maxPrice: "200", sort: "price" });
    expect(page.total).toBe(3);
    expect(page.items.map((item) => item.id)).toEqual(units.slice(1, 4).map((unit) => unit.id));
    expect(page.items.map((item) => item.price)).toEqual([100, 150, 200]);
  });

  it("sorts by area desc", async () => {
    await Promise.all([80, 200, 120].map((area) => makeUnit(companies.a.companyId, { area })));
    const page = await list({ sort: "area", order: "desc" });
    expect(page.items.map((item) => item.area)).toEqual([200, 120, 80]);
  });

  it("sorts by price asc", async () => {
    await Promise.all(
      [300n, 100n, 200n].map((price) => makeUnit(companies.a.companyId, { price })),
    );
    const page = await list({ sort: "price" });
    expect(page.items.map((item) => item.price)).toEqual([100, 200, 300]);
  });

  it("default order is project then number", async () => {
    await Promise.all(
      [
        { projectName: "B", number: "01" },
        { projectName: "A", number: "02" },
        { projectName: "A", number: "01" },
      ].map((fields) => makeUnit(companies.a.companyId, fields)),
    );
    const page = await list({ order: "desc" });
    expect(page.items.map(({ projectName, number }) => [projectName, number])).toEqual([
      ["A", "01"],
      ["A", "02"],
      ["B", "01"],
    ]);
  });

  it("pages with equal prices never repeat or skip", async () => {
    const units = await Promise.all(
      Array.from({ length: 5 }, () => makeUnit(companies.a.companyId, { price: 100n })),
    );
    const first = await list({ sort: "price", pageSize: "3", page: "1" });
    const second = await list({ sort: "price", pageSize: "3", page: "2" });
    expect(first).toMatchObject({ total: 5, page: 1, pageSize: 3 });
    expect(second).toMatchObject({ total: 5, page: 2, pageSize: 3 });
    expect(first.items).toHaveLength(3);
    expect(second.items).toHaveLength(2);
    const ids = [...first.items, ...second.items].map((item) => item.id);
    expect(new Set(ids).size).toBe(5);
    expect(ids).toEqual(units.map((unit) => unit.id).sort());
  });

  it("page past the end is empty with total", async () => {
    await makeUnit(companies.a.companyId);
    expect(await list({ page: "2" })).toEqual({ items: [], total: 1, page: 2, pageSize: 20 });
  });

  it("returns only JSON-safe DTO fields", async () => {
    const unit = await makeUnit(companies.a.companyId, { price: 100_000_000_000n });
    const expected = {
      id: unit.id,
      projectName: unit.projectName,
      number: unit.number,
      type: unit.type,
      area: unit.area,
      rooms: unit.rooms,
      price: 100_000_000_000,
      status: unit.status,
    };
    const page = await list();
    expect(page.items).toEqual([expected]);
    expect(await getUnit(companies.a.manager, unit.id)).toEqual(expected);
    expect(JSON.parse(JSON.stringify(page))).toEqual(page);
  });
});

describe("expiry", () => {
  it("expired reservation lists as AVAILABLE on next read", async () => {
    const unit = await reservedUnit("RESERVED", true);
    const page = await list({ status: "AVAILABLE" });
    expect(page.items).toEqual([expect.objectContaining({ id: unit.id, status: "AVAILABLE" })]);
    expect(page.total).toBe(1);
    expect(await getDb().unit.findUnique({ where: { id: unit.id } })).toMatchObject({
      status: "AVAILABLE",
    });
  });

  it("active reservation stays RESERVED", async () => {
    const unit = await reservedUnit("RESERVED", false);
    const page = await list();
    expect(page.items).toEqual([expect.objectContaining({ id: unit.id, status: "RESERVED" })]);
    expect(await getDb().unit.findUnique({ where: { id: unit.id } })).toMatchObject({
      status: "RESERVED",
    });
  });

  it("SOLD with expired reservation stays SOLD", async () => {
    const unit = await reservedUnit("SOLD", true);
    const page = await list();
    expect(page.items).toEqual([expect.objectContaining({ id: unit.id, status: "SOLD" })]);
    expect(await getDb().unit.findUnique({ where: { id: unit.id } })).toMatchObject({
      status: "SOLD",
    });
  });

  it("getUnit releases too", async () => {
    const unit = await reservedUnit("RESERVED", true);
    expect(await getUnit(companies.a.manager, unit.id)).toMatchObject({
      id: unit.id,
      status: "AVAILABLE",
    });
    expect(await getDb().unit.findUnique({ where: { id: unit.id } })).toMatchObject({
      status: "AVAILABLE",
    });
  });
});

describe("tenant isolation", () => {
  it("lists only the session company's units", async () => {
    const own = await makeUnit(companies.a.companyId);
    const foreign = await makeUnit(companies.b.companyId, { status: "RESERVED" });
    for (const user of [companies.a.manager, companies.a.accountant, companies.a.sales1]) {
      const page = await listUnits(user, unitListQuerySchema.parse({}));
      expect(page).toMatchObject({ total: 1, page: 1, pageSize: 20 });
      expect(page.items.map((item) => item.id)).toEqual([own.id]);
    }
    expect(await getDb().unit.findUnique({ where: { id: foreign.id } })).toMatchObject({
      status: "RESERVED",
    });
  });
});

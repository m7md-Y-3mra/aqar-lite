import { beforeEach, describe, expect, it } from "vitest";

import { createUnit, getUnit, listUnits, updateUnit } from "@/features/units/server/units.service";
import {
  UNIT_NUMBER_TAKEN,
  unitInputSchema,
  unitListQuerySchema,
} from "@/features/units/units.schemas";
import type { UnitInput } from "@/features/units/units.types";
import { getDb } from "@/server/db";
import { AppError } from "@/server/http/app-error";
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
  it.each(["manager", "sales1", "accountant"] as const)(
    "getUnit of company B → NOT_FOUND for %s",
    async (role) => {
      const foreign = await makeUnit(companies.b.companyId);
      await expect(getUnit(companies.a[role], foreign.id)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    },
  );

  it("list filters cannot reach company B", async () => {
    await makeUnit(companies.a.companyId, { price: 100n });
    await makeUnit(companies.b.companyId, { status: "SOLD", price: 200n });
    for (const user of [companies.a.manager, companies.a.sales1, companies.a.accountant]) {
      const page = await listUnits(
        user,
        unitListQuerySchema.parse({ status: "SOLD", minPrice: "200", maxPrice: "200" }),
      );
      expect(page).toMatchObject({ items: [], total: 0 });
    }
  });

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

const validInput: UnitInput = {
  projectName: "مشروع جديد",
  number: "01",
  type: "APARTMENT",
  area: 120,
  rooms: 3,
  price: 10_000_000,
};

function editInput(
  unit: Awaited<ReturnType<typeof makeUnit>>,
  changes: Partial<UnitInput> = {},
): UnitInput {
  return {
    projectName: unit.projectName,
    number: unit.number,
    type: unit.type,
    area: unit.area,
    rooms: unit.rooms,
    price: Number(unit.price),
    ...changes,
  };
}

function audits() {
  return getDb().auditLog.findMany({ where: { companyId: companies.a.companyId } });
}

async function expectDuplicate(promise: Promise<unknown>) {
  await expect(promise).rejects.toBeInstanceOf(AppError);
  await expect(promise).rejects.toMatchObject({
    code: "VALIDATION_ERROR",
    fieldErrors: { number: [UNIT_NUMBER_TAKEN] },
  });
}

describe("create", () => {
  it("manager creates AVAILABLE unit", async () => {
    const dto = await createUnit(companies.a.manager, validInput);
    expect(dto).toEqual({ ...validInput, id: expect.any(String), status: "AVAILABLE" });
    expect(await getDb().unit.findUnique({ where: { id: dto.id } })).toMatchObject({
      companyId: companies.a.companyId,
      status: "AVAILABLE",
      price: BigInt(validInput.price),
    });
    expect(JSON.parse(JSON.stringify(dto))).toEqual(dto);
  });

  it("ignores hand-sent status and companyId", async () => {
    const input = unitInputSchema.parse({
      ...validInput,
      status: "SOLD",
      companyId: companies.b.companyId,
    });
    const dto = await createUnit(companies.a.manager, input);
    expect(dto.status).toBe("AVAILABLE");
    expect(await getDb().unit.findUnique({ where: { id: dto.id } })).toMatchObject({
      companyId: companies.a.companyId,
      status: "AVAILABLE",
    });
  });

  it("duplicate number gives fieldErrors.number", async () => {
    await createUnit(companies.a.manager, validInput);
    await expectDuplicate(createUnit(companies.a.manager, validInput));
    expect(await getDb().unit.count({ where: { companyId: companies.a.companyId } })).toBe(1);
  });

  it("same number in another company is allowed", async () => {
    await createUnit(companies.b.manager, validInput);
    const dto = await createUnit(companies.a.manager, validInput);
    expect(dto.number).toBe(validInput.number);
    expect(await getDb().unit.count({ where: { companyId: companies.a.companyId } })).toBe(1);
  });
});

describe("role checks", () => {
  it.each(["sales1", "accountant"] as const)("%s cannot create", async (role) => {
    await expect(createUnit(companies.a[role], validInput)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(await getDb().unit.count({ where: { companyId: companies.a.companyId } })).toBe(0);
  });

  it.each(["sales1", "accountant"] as const)("%s cannot update", async (role) => {
    const unit = await makeUnit(companies.a.companyId);
    await expect(
      updateUnit(companies.a[role], unit.id, editInput(unit, { area: 200 })),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await getDb().unit.findUnique({ where: { id: unit.id } })).toEqual(unit);
    expect(await audits()).toEqual([]);
  });

  it.each(["manager", "sales1", "accountant"] as const)(
    "%s gets NOT_FOUND before role checks for a foreign unit",
    async (role) => {
      const foreign = await makeUnit(companies.b.companyId);
      await expect(
        updateUnit(companies.a[role], foreign.id, editInput(foreign, { area: 200 })),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(await getDb().unit.findUnique({ where: { id: foreign.id } })).toEqual(foreign);
      expect(
        await getDb().auditLog.count({
          where: { companyId: { in: [companies.a.companyId, companies.b.companyId] } },
        }),
      ).toBe(0);
    },
  );
});

describe("price lock", () => {
  it("RESERVED unit price change → UNIT_PRICE_LOCKED, price unchanged", async () => {
    const unit = await reservedUnit("RESERVED", false);
    await expect(
      updateUnit(companies.a.manager, unit.id, editInput(unit, { price: 20_000_000 })),
    ).rejects.toMatchObject({ code: "UNIT_PRICE_LOCKED" });
    expect(await getDb().unit.findUnique({ where: { id: unit.id } })).toEqual(unit);
  });

  it("SOLD unit → UNIT_PRICE_LOCKED", async () => {
    const unit = await makeUnit(companies.a.companyId, { status: "SOLD" });
    await expect(
      updateUnit(companies.a.manager, unit.id, editInput(unit, { price: 20_000_000 })),
    ).rejects.toMatchObject({ code: "UNIT_PRICE_LOCKED" });
    expect(await getDb().unit.findUnique({ where: { id: unit.id } })).toEqual(unit);
  });

  it("expired reservation → change succeeds", async () => {
    const unit = await reservedUnit("RESERVED", true);
    expect(
      await updateUnit(companies.a.manager, unit.id, editInput(unit, { price: 20_000_000 })),
    ).toMatchObject({ id: unit.id, status: "AVAILABLE", price: 20_000_000 });
    expect(await getDb().unit.findUnique({ where: { id: unit.id } })).toMatchObject({
      status: "AVAILABLE",
      price: 20_000_000n,
    });
  });

  it("reserved after form opened → UNIT_PRICE_LOCKED", async () => {
    const unit = await makeUnit(companies.a.companyId);
    await getUnit(companies.a.manager, unit.id);
    const client = await makeClient(companies.a.companyId, companies.a.sales1.userId);
    await makeReservation({
      companyId: companies.a.companyId,
      unitId: unit.id,
      clientId: client.id,
      salesRepId: companies.a.sales1.userId,
    });
    await getDb().unit.update({ where: { id: unit.id }, data: { status: "RESERVED" } });
    await expect(
      updateUnit(companies.a.manager, unit.id, editInput(unit, { price: 20_000_000 })),
    ).rejects.toMatchObject({ code: "UNIT_PRICE_LOCKED" });
    expect(await getDb().unit.findUnique({ where: { id: unit.id } })).toMatchObject({
      price: unit.price,
      status: "RESERVED",
    });
  });

  it("same price on RESERVED unit is saved", async () => {
    const unit = await reservedUnit("RESERVED", false);
    expect(
      await updateUnit(companies.a.manager, unit.id, editInput(unit, { area: 200 })),
    ).toMatchObject({ area: 200, price: Number(unit.price), status: "RESERVED" });
    expect(await audits()).toEqual([]);
  });

  it("two concurrent price edits never share an oldPrice", async () => {
    const unit = await makeUnit(companies.a.companyId);
    const results = await Promise.allSettled(
      [20_000_000, 30_000_000].map((price) =>
        updateUnit(companies.a.manager, unit.id, editInput(unit, { price })),
      ),
    );
    const successes = results.filter((result) => result.status === "fulfilled");
    expect(successes.length).toBeGreaterThanOrEqual(1);
    for (const result of results) {
      if (result.status === "rejected") {
        expect(result.reason).toBeInstanceOf(AppError);
        expect(result.reason).toMatchObject({ code: "UNIT_CHANGED" });
      }
    }
    const rows = await audits();
    expect(rows).toHaveLength(successes.length);
    for (const row of rows) expect(row.action).toBe("PRICE_CHANGED");
    const changes = rows.map((row) => row.meta as { oldPrice: number; newPrice: number });
    expect(new Set(changes.map((change) => change.oldPrice)).size).toBe(changes.length);
    const first = changes.find((change) => change.oldPrice === Number(unit.price));
    expect(first).toBeDefined();
    // Follow the price chain rather than timestamps, which can share a millisecond.
    const last =
      changes.length === 2 ? changes.find((change) => change.oldPrice === first!.newPrice) : first;
    expect(last).toBeDefined();
    expect(await getDb().unit.findUnique({ where: { id: unit.id } })).toMatchObject({
      price: BigInt(last!.newPrice),
    });
  });
});

describe("audit", () => {
  it("create writes no row", async () => {
    const before = await audits();
    await createUnit(companies.a.manager, validInput);
    expect(await audits()).toEqual(before);
  });

  it("one PRICE_CHANGED with oldPrice/newPrice/userId/entityId", async () => {
    const unit = await makeUnit(companies.a.companyId);
    const dto = await updateUnit(
      companies.a.manager,
      unit.id,
      editInput(unit, { price: 20_000_000 }),
    );
    expect(dto).toMatchObject({ id: unit.id, price: 20_000_000 });
    expect(dto).not.toHaveProperty("companyId");
    expect(JSON.parse(JSON.stringify(dto))).toEqual(dto);
    expect(await audits()).toEqual([
      expect.objectContaining({
        companyId: companies.a.companyId,
        userId: companies.a.manager.userId,
        entityId: unit.id,
        action: "PRICE_CHANGED",
        meta: { oldPrice: Number(unit.price), newPrice: 20_000_000 },
        createdAt: expect.any(Date),
      }),
    ]);
  });

  it("refused change writes no row", async () => {
    const unit = await reservedUnit("RESERVED", false);
    await expect(
      updateUnit(companies.a.manager, unit.id, editInput(unit, { price: 20_000_000 })),
    ).rejects.toMatchObject({ code: "UNIT_PRICE_LOCKED" });
    expect(await audits()).toEqual([]);
  });

  it("same price writes no row", async () => {
    const unit = await makeUnit(companies.a.companyId);
    await updateUnit(companies.a.manager, unit.id, editInput(unit, { rooms: 4 }));
    expect(await audits()).toEqual([]);
  });
});

describe("update", () => {
  it("SOLD unit: area change saved, no audit", async () => {
    const unit = await makeUnit(companies.a.companyId, { status: "SOLD" });
    expect(
      await updateUnit(companies.a.manager, unit.id, editInput(unit, { area: 200 })),
    ).toMatchObject({ area: 200, price: Number(unit.price), status: "SOLD" });
    expect(await audits()).toEqual([]);
  });

  it("hand-sent status is ignored", async () => {
    const unit = await makeUnit(companies.a.companyId, { number: "01", status: "SOLD" });
    const input = unitInputSchema.parse({ ...editInput(unit, { area: 200 }), status: "AVAILABLE" });
    expect(await updateUnit(companies.a.manager, unit.id, input)).toMatchObject({
      area: 200,
      status: "SOLD",
    });
  });

  it("renaming to a taken number gives fieldErrors.number", async () => {
    const taken = await makeUnit(companies.a.companyId, { number: "01" });
    const unit = await makeUnit(companies.a.companyId, { number: "02" });
    await expectDuplicate(
      updateUnit(
        companies.a.manager,
        unit.id,
        editInput(unit, {
          projectName: taken.projectName,
          number: taken.number,
          price: 20_000_000,
        }),
      ),
    );
    expect(await getDb().unit.findUnique({ where: { id: unit.id } })).toEqual(unit);
    expect(await audits()).toEqual([]);
  });
});

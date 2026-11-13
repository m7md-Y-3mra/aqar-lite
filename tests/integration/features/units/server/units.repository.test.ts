import { afterAll, describe, expect, it } from "vitest";

import {
  countUnits,
  findUnit,
  findUnits,
  insertUnit,
  releaseExpired,
  updateUnitDetails,
  updateUnitPriceIfAvailable,
} from "@/features/units/server/units.repository";
import type { UnitInput, UnitListQuery } from "@/features/units/units.types";
import { getDb, isUniqueViolation } from "@/server/db";
import {
  makeClient,
  makeCompany,
  makeReservation,
  makeUnit,
  makeUser,
} from "../../../support/db-fixtures";

const fields = {
  projectName: "مشروع النخيل",
  number: "A-101",
  type: "VILLA" as const,
  area: 150,
  rooms: 4,
};
const input: UnitInput = { ...fields, price: 15_000_00 };

function query(patch: Partial<UnitListQuery> = {}): UnitListQuery {
  return { page: 1, pageSize: 20, order: "asc", ...patch };
}

async function reservedUnit(
  companyId: string,
  expired: boolean,
  status: "RESERVED" | "SOLD" = "RESERVED",
) {
  const unit = await makeUnit(companyId, { status });
  const rep = await makeUser(companyId);
  const client = await makeClient(companyId, rep.id);
  const reservation = await makeReservation({
    companyId,
    unitId: unit.id,
    clientId: client.id,
    salesRepId: rep.id,
  });
  if (expired) {
    await getDb().reservation.update({
      where: { id: reservation.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
  }
  return unit;
}

function ids(rows: { id: string }[]) {
  return rows.map((row) => row.id);
}

afterAll(async () => {
  await getDb().$disconnect();
});

describe("releaseExpired", () => {
  it("expired reservation → AVAILABLE", async () => {
    const company = await makeCompany();
    const unit = await reservedUnit(company.id, true);

    await releaseExpired(company.id);

    expect(await findUnit(company.id, unit.id)).toEqual({ ...unit, status: "AVAILABLE" });
  });

  it("active reservation stays RESERVED", async () => {
    const company = await makeCompany();
    const unit = await reservedUnit(company.id, false);
    // An older expired reservation must not hide a newer active one.
    const rep = await makeUser(company.id);
    const client = await makeClient(company.id, rep.id);
    const oldReservation = await makeReservation({
      companyId: company.id,
      unitId: unit.id,
      clientId: client.id,
      salesRepId: rep.id,
    });
    await getDb().reservation.update({
      where: { id: oldReservation.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    expect(await releaseExpired(company.id)).toBe(0);
    expect(await findUnit(company.id, unit.id)).toEqual(unit);
  });

  it("SOLD with expired reservation stays SOLD", async () => {
    const company = await makeCompany();
    const unit = await reservedUnit(company.id, true, "SOLD");

    expect(await releaseExpired(company.id)).toBe(0);
    expect(await findUnit(company.id, unit.id)).toEqual(unit);
  });

  it("RESERVED unit of another company is not touched", async () => {
    const company = await makeCompany();
    const otherCompany = await makeCompany();
    const unit = await reservedUnit(otherCompany.id, true);

    expect(await releaseExpired(company.id)).toBe(0);
    expect(await findUnit(otherCompany.id, unit.id)).toEqual(unit);
  });

  it("returns the number of released units", async () => {
    const company = await makeCompany();
    const expired = await reservedUnit(company.id, true);
    const orphan = await makeUnit(company.id, { status: "RESERVED" });
    await reservedUnit(company.id, false);
    await reservedUnit(company.id, true, "SOLD");
    await makeUnit(company.id);

    expect(await releaseExpired(company.id)).toBe(2);
    expect(await findUnit(company.id, expired.id)).toMatchObject({ status: "AVAILABLE" });
    expect(await findUnit(company.id, orphan.id)).toMatchObject({ status: "AVAILABLE" });
    expect(await releaseExpired(company.id)).toBe(0);
  });
});

describe("findUnits/countUnits", () => {
  it("filters by status", async () => {
    const company = await makeCompany();
    const available = await makeUnit(company.id);
    const reserved = await makeUnit(company.id, { status: "RESERVED" });
    const sold = await makeUnit(company.id, { status: "SOLD" });

    for (const unit of [available, reserved, sold]) {
      const filters = query({ status: unit.status });
      expect(await findUnits(company.id, filters)).toEqual([unit]);
      expect(await countUnits(company.id, filters)).toBe(1);
    }
  });

  it("price range includes both ends", async () => {
    const company = await makeCompany();
    await makeUnit(company.id, { price: 99n });
    const lower = await makeUnit(company.id, { price: 100n });
    const upper = await makeUnit(company.id, { price: 200n });
    await makeUnit(company.id, { price: 201n });
    const filters = query({ minPrice: 100, maxPrice: 200, sort: "price" });

    expect(await findUnits(company.id, filters)).toEqual([lower, upper]);
    expect(await countUnits(company.id, filters)).toBe(2);
    expect(await countUnits(company.id, query({ minPrice: 200 }))).toBe(2);
    expect(await countUnits(company.id, query({ maxPrice: 100 }))).toBe(2);
    expect(await findUnits(company.id, query({ minPrice: 200, maxPrice: 200 }))).toEqual([upper]);
    expect(await countUnits(company.id, query({ minPrice: 200, maxPrice: 200 }))).toBe(1);
  });

  it("sorts by area desc then id", async () => {
    const company = await makeCompany();
    const small = await makeUnit(company.id, { area: 100 });
    const largeA = await makeUnit(company.id, { area: 200 });
    const largeB = await makeUnit(company.id, { area: 200 });

    expect(ids(await findUnits(company.id, query({ sort: "area", order: "desc" })))).toEqual([
      ...[largeA.id, largeB.id].sort(),
      small.id,
    ]);
  });

  it("default order is project then number then id", async () => {
    const company = await makeCompany();
    const last = await makeUnit(company.id, { projectName: "B", number: "1" });
    const second = await makeUnit(company.id, { projectName: "A", number: "2" });
    const first = await makeUnit(company.id, { projectName: "A", number: "1" });

    // Project + number is unique per company, so an id tie-break cannot occur here.
    expect(await findUnits(company.id, query())).toEqual([first, second, last]);
    expect(await findUnits(company.id, query({ order: "desc" }))).toEqual([first, second, last]);
  });

  it("pages with equal prices never repeat or skip", async () => {
    const company = await makeCompany();
    const units = await Promise.all(
      Array.from({ length: 5 }, () => makeUnit(company.id, { price: 100n })),
    );

    for (const order of ["asc", "desc"] as const) {
      const pages = await Promise.all(
        [1, 2, 3].map((page) =>
          findUnits(company.id, query({ sort: "price", order, page, pageSize: 2 })),
        ),
      );
      expect(pages.map((page) => page.length)).toEqual([2, 2, 1]);
      const allIds = ids(pages.flat());
      expect(new Set(allIds).size).toBe(5);
      expect(allIds).toEqual(ids(units).sort());
    }
  });

  it("page past the end is empty while count is unchanged", async () => {
    const company = await makeCompany();
    await makeUnit(company.id);
    const filters = query({ page: 2, pageSize: 2 });

    expect(await findUnits(company.id, filters)).toEqual([]);
    expect(await countUnits(company.id, filters)).toBe(1);
  });

  it("never returns another company's units", async () => {
    const company = await makeCompany();
    const otherCompany = await makeCompany();
    const unit = await makeUnit(company.id, { price: 100n });
    await makeUnit(otherCompany.id, { status: "SOLD", price: 200n });

    expect(await findUnits(company.id, query())).toEqual([unit]);
    expect(await countUnits(company.id, query())).toBe(1);
    const foreignFilters = query({ status: "SOLD", minPrice: 200, maxPrice: 200 });
    expect(await findUnits(company.id, foreignFilters)).toEqual([]);
    expect(await countUnits(company.id, foreignFilters)).toBe(0);
  });
});

describe("findUnit", () => {
  it("returns null for another company's unit", async () => {
    const company = await makeCompany();
    const otherCompany = await makeCompany();
    const unit = await makeUnit(otherCompany.id);

    expect(await findUnit(company.id, unit.id)).toBeNull();
  });
});

describe("insertUnit", () => {
  it("duplicate project + number is a unique violation on units_company_id_project_name_number_key", async () => {
    const company = await makeCompany();
    await insertUnit(company.id, input);
    const error: unknown = await insertUnit(company.id, input).then(
      () => undefined,
      (failure: unknown) => failure,
    );

    expect(error).toBeDefined();
    expect(isUniqueViolation(error, "units_company_id_project_name_number_key")).toBe(true);
    expect(isUniqueViolation(error, "users_email_key")).toBe(false);
  });

  it("same project + number in another company is allowed", async () => {
    const company = await makeCompany();
    const otherCompany = await makeCompany();
    await insertUnit(company.id, input);

    expect(await insertUnit(otherCompany.id, input)).toMatchObject({
      ...input,
      companyId: otherCompany.id,
      price: BigInt(input.price),
    });
  });

  it("new unit is AVAILABLE", async () => {
    const company = await makeCompany();

    const unit = await insertUnit(company.id, input);

    expect(unit).toEqual({
      ...input,
      id: expect.any(String),
      companyId: company.id,
      price: BigInt(input.price),
      status: "AVAILABLE",
    });
  });
});

describe("updateUnitPriceIfAvailable", () => {
  it("AVAILABLE + matching old price → 1", async () => {
    const company = await makeCompany();
    const unit = await makeUnit(company.id);

    expect(await updateUnitPriceIfAvailable(company.id, unit.id, input, unit.price)).toBe(1);
    expect(await findUnit(company.id, unit.id)).toEqual({
      ...unit,
      ...input,
      price: BigInt(input.price),
    });
  });

  it("RESERVED → 0 and price unchanged", async () => {
    const company = await makeCompany();
    const unit = await makeUnit(company.id, { status: "RESERVED" });

    expect(await updateUnitPriceIfAvailable(company.id, unit.id, input, unit.price)).toBe(0);
    expect(await findUnit(company.id, unit.id)).toEqual(unit);
  });

  it("old price no longer matches → 0", async () => {
    const company = await makeCompany();
    const unit = await makeUnit(company.id);

    expect(await updateUnitPriceIfAvailable(company.id, unit.id, input, unit.price + 1n)).toBe(0);
    expect(await findUnit(company.id, unit.id)).toEqual(unit);
  });

  it("another company → 0", async () => {
    const company = await makeCompany();
    const otherCompany = await makeCompany();
    const unit = await makeUnit(otherCompany.id);

    expect(await updateUnitPriceIfAvailable(company.id, unit.id, input, unit.price)).toBe(0);
    expect(await findUnit(otherCompany.id, unit.id)).toEqual(unit);
  });
});

describe("updateUnitDetails", () => {
  it("updates fields on a SOLD unit and leaves price and status alone", async () => {
    const company = await makeCompany();
    const unit = await makeUnit(company.id, { status: "SOLD" });

    expect(await updateUnitDetails(company.id, unit.id, fields)).toBe(1);
    expect(await findUnit(company.id, unit.id)).toEqual({ ...unit, ...fields });
  });

  it("another company → 0", async () => {
    const company = await makeCompany();
    const otherCompany = await makeCompany();
    const unit = await makeUnit(otherCompany.id);

    expect(await updateUnitDetails(company.id, unit.id, fields)).toBe(0);
    expect(await findUnit(otherCompany.id, unit.id)).toEqual(unit);
  });
});

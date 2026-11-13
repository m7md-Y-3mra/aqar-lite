import { afterAll, describe, expect, it } from "vitest";

import { getDb } from "@/server/db";
import { expectDbError, makeCompany, makeUnit, makeUser } from "../support/db-fixtures";

afterAll(async () => {
  await getDb().$disconnect();
});

describe("units and clients checks", () => {
  it.each(["  ", "", " x"])("rejects empty or untrimmed name: %j", async (name) => {
    const company = await makeCompany();
    const rep = await makeUser(company.id);
    await expectDbError(
      getDb().client.create({
        data: { companyId: company.id, salesRepId: rep.id, name, phone: "0500000000" },
      }),
      { code: "23514", constraint: "clients_name_check" },
    );
  });

  it.each(["  ", "", " x"])("rejects empty or untrimmed phone: %j", async (phone) => {
    const company = await makeCompany();
    const rep = await makeUser(company.id);
    await expectDbError(
      getDb().client.create({
        data: { companyId: company.id, salesRepId: rep.id, name: "عميل اختبار", phone },
      }),
      { code: "23514", constraint: "clients_phone_check" },
    );
  });

  it("rejects price above 10^11 halalas", async () => {
    const company = await makeCompany();
    await expectDbError(makeUnit(company.id, { price: 100_000_000_001n }), {
      code: "23514",
      constraint: "units_price_max_check",
    });
  });

  it("accepts price of exactly 10^11 halalas", async () => {
    const company = await makeCompany();
    expect((await makeUnit(company.id, { price: 100_000_000_000n })).price).toBe(100_000_000_000n);
  });
});

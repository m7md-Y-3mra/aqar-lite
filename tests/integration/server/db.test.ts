import { afterAll, describe, expect, it } from "vitest";

import { getDb, isUniqueViolation, withTransaction } from "@/server/db";
import { makeCompany, makeUnit } from "../support/db-fixtures";

afterAll(async () => {
  await getDb().$disconnect();
});

describe("db", () => {
  it("runs a real query on the test database", async () => {
    const rows = await withTransaction(
      (tx) => tx.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`,
    );
    expect(rows[0]?.db).toBe("aqar_test");
  });

  it("rejects the transaction when the callback throws", async () => {
    await expect(
      withTransaction(async (tx) => {
        await tx.$queryRaw`SELECT 1`;
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
  });
});

describe("isUniqueViolation", () => {
  it("recognizes the Prisma pg adapter's named unique violation", async () => {
    const company = await makeCompany();
    const unit = await makeUnit(company.id);
    const error: unknown = await makeUnit(company.id, {
      projectName: unit.projectName,
      number: unit.number,
    }).then(
      () => undefined,
      (failure: unknown) => failure,
    );

    expect(error).toMatchObject({ code: "P2002" });
    expect(isUniqueViolation(error, "units_company_id_project_name_number_key")).toBe(true);
    expect(isUniqueViolation(error, "users_email_key")).toBe(false);
  });

  it("does not mistake a check violation for a unique violation", async () => {
    const company = await makeCompany();
    const error: unknown = await makeUnit(company.id, { price: 0n }).then(
      () => undefined,
      (failure: unknown) => failure,
    );

    expect(error).toBeDefined();
    expect(isUniqueViolation(error, "units_price_check")).toBe(false);
  });

  it("does not accept unrelated errors or lookalike objects", () => {
    for (const error of [
      null,
      undefined,
      "P2002",
      new Error("units_key"),
      {
        code: "P2002",
        meta: { constraint: "units_key" },
      },
    ]) {
      expect(isUniqueViolation(error, "units_key")).toBe(false);
    }
  });
});

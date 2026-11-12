import { describe, expect, it } from "vitest";

import { SEED_DATA, SEED_PASSWORD } from "../../../prisma/seed-data.ts";

describe("seed data", () => {
  it("contains exactly the contracted companies, emails and roles", () => {
    expect(SEED_PASSWORD).toBe("AqarLite#2026");
    expect(SEED_DATA.companies).toHaveLength(2);
    expect(SEED_DATA.users).toHaveLength(8);
    const actual = SEED_DATA.users.map((user) => ({
      email: user.email,
      role: user.role,
      company: SEED_DATA.companies.find((company) => company.id === user.companyId)?.name,
    }));
    const expected = [
      ["ufuq", "شركة الأفق للتطوير العقاري"],
      ["nukhba", "شركة النخبة العقارية"],
    ].flatMap(([domain, company]) => [
      { email: `manager@${domain}.test`, role: "MANAGER", company },
      { email: `accountant@${domain}.test`, role: "ACCOUNTANT", company },
      { email: `sales1@${domain}.test`, role: "SALES", company },
      { email: `sales2@${domain}.test`, role: "SALES", company },
    ]);
    expect(actual).toEqual(expect.arrayContaining(expected));
    for (const user of SEED_DATA.users) {
      expect(user.email).toBe(user.email.trim().toLowerCase());
    }
    for (const company of SEED_DATA.companies) {
      const roles = SEED_DATA.users
        .filter((user) => user.companyId === company.id)
        .map((user) => user.role);
      expect(roles.sort()).toEqual(["ACCOUNTANT", "MANAGER", "SALES", "SALES"]);
    }
  });

  it("has varied available units with unique project+number per company", () => {
    for (const company of SEED_DATA.companies) {
      const units = SEED_DATA.units.filter((unit) => unit.companyId === company.id);
      expect(units.length).toBeGreaterThanOrEqual(10);
      expect(new Set(units.map((unit) => unit.type)).size).toBeGreaterThanOrEqual(3);
      expect(new Set(units.map((unit) => unit.price)).size).toBeGreaterThan(1);
      expect(new Set(units.map((unit) => unit.area)).size).toBeGreaterThan(1);
      expect(
        new Set(units.map((unit) => JSON.stringify([unit.projectName, unit.number]))).size,
      ).toBe(units.length);
      for (const unit of units) {
        expect(unit.status).toBe("AVAILABLE");
        expect(unit.price).toBeGreaterThan(0n);
        expect(unit.area).toBeGreaterThan(0);
        expect(unit.rooms).toBeGreaterThanOrEqual(0);
        expect(unit.projectName).toBe(unit.projectName.trim());
        expect(unit.number).toBe(unit.number.trim());
      }
    }
    expect(
      SEED_DATA.units.every((unit) =>
        SEED_DATA.companies.some((company) => company.id === unit.companyId),
      ),
    ).toBe(true);
  });

  it("gives every sales rep at least three same-company clients and notes", () => {
    const reps = SEED_DATA.users.filter((user) => user.role === "SALES");
    for (const rep of reps) {
      const clients = SEED_DATA.clients.filter((client) => client.salesRepId === rep.id);
      expect(clients.length).toBeGreaterThanOrEqual(3);
      expect(clients.every((client) => client.companyId === rep.companyId)).toBe(true);
      expect(clients.some((client) => Boolean(client.notes?.trim()))).toBe(true);
    }
    for (const client of SEED_DATA.clients) {
      expect(
        reps.some((rep) => rep.id === client.salesRepId && rep.companyId === client.companyId),
      ).toBe(true);
    }
  });

  it("uses unique UUIDs for every row and bigint unit prices", () => {
    const rows = [
      ...SEED_DATA.companies,
      ...SEED_DATA.users,
      ...SEED_DATA.units,
      ...SEED_DATA.clients,
    ];
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
    for (const row of rows) {
      expect(row.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    }
    for (const unit of SEED_DATA.units) expect(typeof unit.price).toBe("bigint");
  });
});

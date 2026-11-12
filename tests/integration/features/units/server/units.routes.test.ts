import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";

import { getUnitHandler, listUnitsHandler } from "@/features/units/server/units.routes";
import { SESSION_COOKIE } from "@/server/auth/session-token";
import { makeSession, makeUnit } from "../../../support/db-fixtures";
import { apiRequest, readJson } from "../../../support/http";
import { makeTwoCompanies } from "../../../support/session-users";

let companies: Awaited<ReturnType<typeof makeTwoCompanies>>;
let cookie: string;

beforeEach(async () => {
  companies = await makeTwoCompanies();
  const token = await makeSession(companies.a.manager.userId, new Date(Date.now() + 86_400_000));
  cookie = `${SESSION_COOKIE}=${token}`;
});

function list(query = "") {
  return listUnitsHandler(apiRequest(`/api/units${query}`, { method: "GET", cookie }), undefined);
}

function detail(id: string) {
  return getUnitHandler(apiRequest(`/api/units/${id}`, { method: "GET", cookie }), {
    params: Promise.resolve({ id }),
  });
}

describe("units routes", () => {
  it.each([
    ["pageSize=51", "?pageSize=51", "pageSize"],
    ["minPrice > maxPrice", "?minPrice=200&maxPrice=100", "minPrice"],
  ])("GET /api/units returns 400 with fieldErrors for %s", async (_name, query, field) => {
    const response = await list(query);
    expect(response.status).toBe(400);
    expect(await readJson(response)).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: expect.any(String),
        fieldErrors: { [field]: [expect.any(String)] },
      },
    });
  });

  it("GET /api/units without a session returns 401", async () => {
    const response = await listUnitsHandler(apiRequest("/api/units", { method: "GET" }), undefined);
    expect(response.status).toBe(401);
    expect(await readJson(response)).toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });

  it("GET /api/units?companyId=<company B id> still lists only company A units", async () => {
    const own = await makeUnit(companies.a.companyId);
    await makeUnit(companies.b.companyId);
    const response = await list(`?companyId=${companies.b.companyId}`);
    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({
      data: {
        items: [
          {
            id: own.id,
            projectName: own.projectName,
            number: own.number,
            type: own.type,
            area: own.area,
            rooms: own.rooms,
            price: Number(own.price),
            status: own.status,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      },
    });
  });

  it("GET /api/units/<non-uuid> returns 404", async () => {
    const response = await detail("not-a-uuid");
    expect(response.status).toBe(404);
    expect(await readJson(response)).toMatchObject({ error: { code: "NOT_FOUND" } });
  });

  it("GET /api/units/<company B unit id> returns 404", async () => {
    const foreign = await makeUnit(companies.b.companyId);
    const response = await detail(foreign.id);
    expect(response.status).toBe(404);
    expect(await readJson(response)).toMatchObject({ error: { code: "NOT_FOUND" } });
  });

  it("GET /api/units/<missing uuid> returns 404", async () => {
    const response = await detail(randomUUID());
    expect(response.status).toBe(404);
    expect(await readJson(response)).toMatchObject({ error: { code: "NOT_FOUND" } });
  });

  it.each(["manager", "accountant", "sales1"] as const)(
    "GET /api/units/<own unit id> returns the DTO for %s",
    async (role) => {
      const user = companies.a[role];
      const token = await makeSession(user.userId, new Date(Date.now() + 86_400_000));
      cookie = `${SESSION_COOKIE}=${token}`;
      const unit = await makeUnit(companies.a.companyId);
      const response = await detail(unit.id);
      expect(response.status).toBe(200);
      expect(await readJson(response)).toEqual({
        data: {
          id: unit.id,
          projectName: unit.projectName,
          number: unit.number,
          type: unit.type,
          area: unit.area,
          rooms: unit.rooms,
          price: Number(unit.price),
          status: unit.status,
        },
      });
    },
  );
});

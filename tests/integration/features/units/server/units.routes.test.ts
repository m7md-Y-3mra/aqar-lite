import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";

import { GET as listUnitsHandler, POST } from "@/app/api/units/route";
import { GET as getUnitHandler, PATCH } from "@/app/api/units/[id]/route";
import type { UnitInput } from "@/features/units/units.types";
import { UNIT_NUMBER_TAKEN } from "@/features/units/units.schemas";
import { getDb } from "@/server/db";
import { SESSION_COOKIE } from "@/server/auth/session-token";
import { makeClient, makeReservation, makeSession, makeUnit } from "../../../support/db-fixtures";
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
            reservedUntil: null,
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

  it.each(["manager", "sales1", "accountant"] as const)(
    "GET /api/units/<company B unit id> returns 404 for %s",
    async (role) => {
      await signIn(role);
      const foreign = await makeUnit(companies.b.companyId);
      const response = await detail(foreign.id);
      expect(response.status).toBe(404);
      expect(await readJson(response)).toMatchObject({ error: { code: "NOT_FOUND" } });
    },
  );

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
          reservedUntil: null,
        },
      });
    },
  );
});

const validInput: UnitInput = {
  projectName: "مشروع جديد",
  number: "01",
  type: "APARTMENT",
  area: 120,
  rooms: 3,
  price: 10_000_000,
};

async function signIn(role: "manager" | "accountant" | "sales1") {
  const token = await makeSession(companies.a[role].userId, new Date(Date.now() + 86_400_000));
  cookie = `${SESSION_COOKIE}=${token}`;
}

function patch(id: string, body: unknown = validInput) {
  return PATCH(apiRequest(`/api/units/${id}`, { method: "PATCH", cookie, body }), {
    params: Promise.resolve({ id }),
  });
}

describe("unit mutations", () => {
  it("POST /api/units with a valid body as ACCOUNTANT returns 403", async () => {
    await signIn("accountant");
    const response = await POST(
      apiRequest("/api/units", {
        method: "POST",
        cookie,
        body: validInput,
      }),
      undefined,
    );
    expect(response.status).toBe(403);
    expect(await readJson(response)).toMatchObject({ error: { code: "FORBIDDEN" } });
    expect(await getDb().unit.count({ where: { companyId: companies.a.companyId } })).toBe(0);
  });

  it("POST with a foreign Origin returns 403 INVALID_ORIGIN", async () => {
    const response = await POST(
      apiRequest("/api/units", {
        method: "POST",
        cookie,
        body: validInput,
        origin: "https://foreign.test",
      }),
      undefined,
    );
    expect(response.status).toBe(403);
    expect(await readJson(response)).toMatchObject({ error: { code: "INVALID_ORIGIN" } });
    expect(await getDb().unit.count({ where: { companyId: companies.a.companyId } })).toBe(0);
  });

  it("POST as MANAGER returns 201 and strips status and companyId", async () => {
    const response = await POST(
      apiRequest("/api/units", {
        method: "POST",
        cookie,
        body: { ...validInput, status: "SOLD", companyId: companies.b.companyId },
      }),
      undefined,
    );
    expect(response.status).toBe(201);
    expect(await readJson(response)).toEqual({
      data: { ...validInput, id: expect.any(String), status: "AVAILABLE", reservedUntil: null },
    });
    expect(await getDb().unit.count({ where: { companyId: companies.a.companyId } })).toBe(1);
    expect(await getDb().unit.count({ where: { companyId: companies.b.companyId } })).toBe(0);
  });

  it("POST duplicate number returns 400 with fieldErrors.number", async () => {
    await makeUnit(companies.a.companyId, { ...validInput, price: BigInt(validInput.price) });
    const response = await POST(
      apiRequest("/api/units", {
        method: "POST",
        cookie,
        body: validInput,
      }),
      undefined,
    );
    expect(response.status).toBe(400);
    expect(await readJson(response)).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
        fieldErrors: { number: [UNIT_NUMBER_TAKEN] },
      },
    });
  });

  it.each(["{", { ...validInput, area: 0 }])("POST invalid body returns 400: %j", async (body) => {
    const response = await POST(
      apiRequest("/api/units", { method: "POST", cookie, body }),
      undefined,
    );
    expect(response.status).toBe(400);
    expect(await readJson(response)).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  it("PATCH reserved unit with a new price returns 409 UNIT_PRICE_LOCKED", async () => {
    const unit = await makeUnit(companies.a.companyId, { status: "RESERVED" });
    const client = await makeClient(companies.a.companyId, companies.a.sales1.userId);
    await makeReservation({
      companyId: companies.a.companyId,
      unitId: unit.id,
      clientId: client.id,
      salesRepId: companies.a.sales1.userId,
    });
    const response = await patch(unit.id, { ...validInput, price: Number(unit.price) + 100 });
    expect(response.status).toBe(409);
    expect(await readJson(response)).toMatchObject({ error: { code: "UNIT_PRICE_LOCKED" } });
    expect(await getDb().unit.findUnique({ where: { id: unit.id } })).toEqual(unit);
    expect(await getDb().auditLog.count({ where: { companyId: companies.a.companyId } })).toBe(0);
  });

  it("PATCH with a valid body as SALES returns 403", async () => {
    await signIn("sales1");
    const unit = await makeUnit(companies.a.companyId);
    const response = await patch(unit.id);
    expect(response.status).toBe(403);
    expect(await readJson(response)).toMatchObject({ error: { code: "FORBIDDEN" } });
    expect(await getDb().unit.findUnique({ where: { id: unit.id } })).toEqual(unit);
  });

  it("PATCH available unit returns updated DTO and ignores status", async () => {
    const unit = await makeUnit(companies.a.companyId);
    const response = await patch(unit.id, { ...validInput, area: 200, status: "SOLD" });
    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({
      data: { ...validInput, area: 200, id: unit.id, status: "AVAILABLE", reservedUntil: null },
    });
  });

  it("PATCH invalid id returns 404 before parsing the body", async () => {
    const response = await patch("not-a-uuid", "{");
    expect(response.status).toBe(404);
    expect(await readJson(response)).toMatchObject({ error: { code: "NOT_FOUND" } });
  });

  it("PATCH another company's unit returns 404", async () => {
    const unit = await makeUnit(companies.b.companyId);
    const response = await patch(unit.id);
    expect(response.status).toBe(404);
    expect(await readJson(response)).toMatchObject({ error: { code: "NOT_FOUND" } });
    expect(await getDb().unit.findUnique({ where: { id: unit.id } })).toEqual(unit);
  });
});

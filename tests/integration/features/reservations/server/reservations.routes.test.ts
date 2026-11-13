import { beforeEach, describe, expect, it } from "vitest";

import { POST as reserveHandler } from "@/app/api/reservations/route";
import { GET as reserveOptionsHandler } from "@/app/api/reservations/options/route";
import { SESSION_COOKIE } from "@/server/auth/session-token";
import { getDb } from "@/server/db";
import { makeClient, makeSession, makeUnit } from "../../../support/db-fixtures";
import { apiRequest, readJson } from "../../../support/http";
import { makeTwoCompanies } from "../../../support/session-users";

let companies: Awaited<ReturnType<typeof makeTwoCompanies>>;
let cookie: string;

beforeEach(async () => {
  companies = await makeTwoCompanies();
  cookie = await sessionCookie(companies.a.sales1.userId);
});

async function sessionCookie(userId: string) {
  const token = await makeSession(userId, new Date(Date.now() + 86_400_000));
  return `${SESSION_COOKIE}=${token}`;
}

async function ownInput() {
  const unit = await makeUnit(companies.a.companyId);
  const client = await makeClient(companies.a.companyId, companies.a.sales1.userId);
  return { unitId: unit.id, clientId: client.id };
}

async function unitState(unitId: string) {
  const unit = await getDb().unit.findUniqueOrThrow({ where: { id: unitId } });
  return {
    status: unit.status,
    reservations: await getDb().reservation.count({ where: { unitId } }),
  };
}

function post(body: unknown, origin?: string) {
  return reserveHandler(
    apiRequest("/api/reservations", { method: "POST", cookie, body, origin }),
    undefined,
  );
}

describe("reservations routes", () => {
  it("POST as accountant → 403", async () => {
    const input = await ownInput();
    cookie = await sessionCookie(companies.a.accountant.userId);
    const before = await unitState(input.unitId);
    const response = await post(input);
    expect(response.status).toBe(403);
    expect(await readJson(response)).toMatchObject({ error: { code: "FORBIDDEN" } });
    expect(await unitState(input.unitId)).toEqual(before);
  });

  it("POST with another rep's client → 404", async () => {
    const input = await ownInput();
    const other = await makeClient(companies.a.companyId, companies.a.sales2.userId);
    const before = await unitState(input.unitId);
    const response = await post({ ...input, clientId: other.id });
    expect(response.status).toBe(404);
    expect(await readJson(response)).toMatchObject({ error: { code: "NOT_FOUND" } });
    expect(await unitState(input.unitId)).toEqual(before);
  });

  it("409 body has code UNIT_NOT_AVAILABLE and the Arabic message", async () => {
    const input = await ownInput();
    expect((await post(input)).status).toBe(201);
    const before = await unitState(input.unitId);
    const response = await post(input);
    expect(response.status).toBe(409);
    expect(await readJson(response)).toEqual({
      error: {
        code: "UNIT_NOT_AVAILABLE",
        message: "هذه الوحدة لم تعد متاحة، فقد حُجزت للتو. اختر وحدة أخرى.",
      },
    });
    expect(await unitState(input.unitId)).toEqual(before);
  });

  it("400 with fieldErrors.unitId and fieldErrors.clientId", async () => {
    const input = await ownInput();
    const before = await unitState(input.unitId);
    const response = await post({ unitId: "not-a-uuid" });
    expect(response.status).toBe(400);
    expect(await readJson(response)).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
        fieldErrors: { unitId: [expect.any(String)], clientId: [expect.any(String)] },
      },
    });
    expect(await unitState(input.unitId)).toEqual(before);
  });

  it("POST with a foreign Origin → 403 INVALID_ORIGIN", async () => {
    const input = await ownInput();
    const before = await unitState(input.unitId);
    const response = await post(input, "https://foreign.test");
    expect(response.status).toBe(403);
    expect(await readJson(response)).toMatchObject({ error: { code: "INVALID_ORIGIN" } });
    expect(await unitState(input.unitId)).toEqual(before);
  });

  it("two parallel POSTs from two rep sessions: one 201, one 409", async () => {
    const input = await ownInput();
    const client2 = await makeClient(companies.a.companyId, companies.a.sales2.userId);
    const cookie2 = await sessionCookie(companies.a.sales2.userId);
    const results = await Promise.allSettled([
      post(input),
      reserveHandler(
        apiRequest("/api/reservations", {
          method: "POST",
          cookie: cookie2,
          body: { unitId: input.unitId, clientId: client2.id },
        }),
        undefined,
      ),
    ]);
    expect(results.every((result) => result.status === "fulfilled")).toBe(true);
    const responses = results
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    const conflict = responses.find((response) => response.status === 409);
    expect(conflict).toBeDefined();
    expect(await readJson(conflict!)).toMatchObject({ error: { code: "UNIT_NOT_AVAILABLE" } });
    expect(await unitState(input.unitId)).toEqual({ status: "RESERVED", reservations: 1 });
  });

  it("route modules export no DELETE, PATCH or PUT", async () => {
    // GET /api/reservations belongs to T025, outside this backend part's T017 scope.
    expect(Object.keys(await import("@/app/api/reservations/route")).sort()).toEqual(["POST"]);
    expect(Object.keys(await import("@/app/api/reservations/options/route")).sort()).toEqual([
      "GET",
    ]);
  });

  it("GET /api/reservations/options as manager → 403", async () => {
    const unit = await makeUnit(companies.a.companyId);
    cookie = await sessionCookie(companies.a.manager.userId);
    const before = await unitState(unit.id);
    const response = await reserveOptionsHandler(
      apiRequest(`/api/reservations/options?unitId=${unit.id}`, {
        method: "GET",
        cookie,
      }),
      undefined,
    );
    expect(response.status).toBe(403);
    expect(await readJson(response)).toMatchObject({ error: { code: "FORBIDDEN" } });
    expect(await unitState(unit.id)).toEqual(before);
  });
});

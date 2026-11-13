import { beforeEach, describe, expect, it } from "vitest";

import { POST as approveHandler } from "@/app/api/contracts/[id]/approve/route";
import { GET as getHandler, PATCH as updateHandler } from "@/app/api/contracts/[id]/route";
import { POST as createHandler } from "@/app/api/contracts/route";
import type { SessionUser } from "@/server/auth/session.service";
import { SESSION_COOKIE } from "@/server/auth/session-token";
import { getDb } from "@/server/db";
import {
  makeClient,
  makeContract,
  makeReservation,
  makeSession,
  makeUnit,
} from "../../../support/db-fixtures";
import { apiRequest, readJson } from "../../../support/http";
import { makeTwoCompanies } from "../../../support/session-users";

let companies: Awaited<ReturnType<typeof makeTwoCompanies>>;
let cookie: string;
const terms = { finalPrice: 10_000_000, downPayment: 1_000_000, installmentCount: 3 };

beforeEach(async () => {
  companies = await makeTwoCompanies();
  cookie = await sessionCookie(companies.a.sales1.userId);
});

async function sessionCookie(userId: string) {
  const token = await makeSession(userId, new Date(Date.now() + 86_400_000));
  return `${SESSION_COOKIE}=${token}`;
}

async function reservationFixture(owner: SessionUser = companies.a.sales1) {
  const unit = await makeUnit(owner.companyId, { status: "RESERVED" });
  const client = await makeClient(owner.companyId, owner.userId);
  const reservation = await makeReservation({
    companyId: owner.companyId,
    unitId: unit.id,
    clientId: client.id,
    salesRepId: owner.userId,
  });
  return { unit, reservation };
}

async function draftFixture(owner: SessionUser = companies.a.sales1, approved = false) {
  const fixture = await reservationFixture(owner);
  if (approved) {
    await getDb().unit.update({ where: { id: fixture.unit.id }, data: { status: "SOLD" } });
  }
  const contract = await makeContract(owner.companyId, fixture.reservation.id, {
    finalPrice: BigInt(terms.finalPrice),
    downPayment: BigInt(terms.downPayment),
    installmentCount: terms.installmentCount,
    approvedAt: approved ? new Date() : null,
  });
  return { ...fixture, contract };
}

async function state(id: string, unitId: string) {
  return {
    contract: await getDb().contract.findUniqueOrThrow({ where: { id } }),
    unit: await getDb().unit.findUniqueOrThrow({ where: { id: unitId } }),
    installments: await getDb().installment.count({ where: { contractId: id } }),
    audit: await getDb().auditLog.count({ where: { entityId: id, action: "CONTRACT_APPROVED" } }),
  };
}

function mutate(operation: "create" | "edit" | "approve", id: string, body: unknown, options: {
  origin?: string | null;
  cookie?: string;
} = {}) {
  if (operation === "create") {
    return createHandler(apiRequest("/api/contracts", {
      method: "POST", body, cookie: options.cookie ?? cookie, origin: options.origin,
    }), undefined);
  }
  const path = `/api/contracts/${id}${operation === "approve" ? "/approve" : ""}`;
  return (operation === "edit" ? updateHandler : approveHandler)(apiRequest(path, {
    method: operation === "edit" ? "PATCH" : "POST",
    body,
    cookie: options.cookie ?? cookie,
    origin: options.origin,
  }), { params: Promise.resolve({ id }) });
}

describe("contracts routes", () => {
  it("POST as accountant → 403", async () => {
    const { reservation } = await reservationFixture();
    cookie = await sessionCookie(companies.a.accountant.userId);
    const response = await mutate("create", reservation.id, { ...terms, reservationId: reservation.id });
    expect(response.status).toBe(403);
    expect(await readJson(response)).toMatchObject({ error: { code: "FORBIDDEN" } });
    expect(await getDb().contract.count({ where: { reservationId: reservation.id } })).toBe(0);
  });

  it("PATCH as manager → 403", async () => {
    const { contract, unit } = await draftFixture();
    const before = await state(contract.id, unit.id);
    cookie = await sessionCookie(companies.a.manager.userId);
    const response = await mutate("edit", contract.id, terms);
    expect(response.status).toBe(403);
    expect(await readJson(response)).toMatchObject({ error: { code: "FORBIDDEN" } });
    expect(await state(contract.id, unit.id)).toEqual(before);
  });

  it("PATCH on approved → 409", async () => {
    const { contract, unit } = await draftFixture(companies.a.sales1, true);
    const before = await state(contract.id, unit.id);
    const response = await mutate("edit", contract.id, { ...terms, finalPrice: 11_000_000 });
    expect(response.status).toBe(409);
    expect(await readJson(response)).toMatchObject({ error: { code: "CONTRACT_ALREADY_APPROVED" } });
    expect(await state(contract.id, unit.id)).toEqual(before);
  });

  it.each(["create", "edit", "approve"] as const)(
    "%s: 400 has fieldErrors.finalPrice / downPayment / installmentCount",
    async (operation) => {
      const { contract, reservation, unit } = await draftFixture();
      const before = await state(contract.id, unit.id);
      cookie = await sessionCookie(operation === "approve" ? companies.a.accountant.userId : companies.a.sales1.userId);
      const response = await mutate(operation, contract.id, {
        reservationId: reservation.id, finalPrice: 0, downPayment: -1, installmentCount: 0,
      });
      expect(response.status).toBe(400);
      expect(await readJson(response)).toMatchObject({
        error: { code: "VALIDATION_ERROR", fieldErrors: {
          finalPrice: [expect.any(String)],
          downPayment: [expect.any(String)],
          installmentCount: [expect.any(String)],
        } },
      });
      expect(await state(contract.id, unit.id)).toEqual(before);
    },
  );

  it("409 body has code CONTRACT_CHANGED and the Arabic message", async () => {
    const { contract, unit } = await draftFixture();
    const before = await state(contract.id, unit.id);
    cookie = await sessionCookie(companies.a.accountant.userId);
    const response = await mutate("approve", contract.id, { ...terms, finalPrice: 11_000_000 });
    expect(response.status).toBe(409);
    expect(await readJson(response)).toEqual({ error: {
      code: "CONTRACT_CHANGED",
      message: "تم تعديل العقد بعد أن فتحته، راجع القيم الجديدة ثم اعتمد مرة أخرى",
    } });
    expect(await state(contract.id, unit.id)).toEqual(before);
  });

  it("GET /api/contracts/{B id} as A → 404", async () => {
    const { contract } = await draftFixture(companies.b.sales1);
    cookie = await sessionCookie(companies.a.manager.userId);
    const response = await getHandler(apiRequest(`/api/contracts/${contract.id}`, {
      method: "GET", cookie,
    }), { params: Promise.resolve({ id: contract.id }) });
    expect(response.status).toBe(404);
    expect(await readJson(response)).toMatchObject({ error: { code: "NOT_FOUND" } });
  });

  it("route modules export only the documented methods", async () => {
    expect(Object.keys(await import("@/app/api/contracts/route")).sort()).toEqual(["GET", "POST"]);
    expect(Object.keys(await import("@/app/api/contracts/options/route")).sort()).toEqual(["GET"]);
    expect(Object.keys(await import("@/app/api/contracts/[id]/route")).sort()).toEqual(["GET", "PATCH"]);
    expect(Object.keys(await import("@/app/api/contracts/[id]/approve/route")).sort()).toEqual(["POST"]);
  });

  it.each(["create", "edit", "approve"] as const)("%s rejects foreign and missing Origin", async (operation) => {
    const { contract, reservation, unit } = await draftFixture();
    const before = await state(contract.id, unit.id);
    for (const origin of ["https://foreign.test", null]) {
      const response = await mutate(operation, contract.id, { ...terms, reservationId: reservation.id }, { origin });
      expect(response.status).toBe(403);
      expect(await readJson(response)).toMatchObject({ error: { code: "INVALID_ORIGIN" } });
    }
    expect(await state(contract.id, unit.id)).toEqual(before);
  });

  it.each(["create", "edit", "approve"] as const)("%s requires a session", async (operation) => {
    const { contract, reservation, unit } = await draftFixture();
    const before = await state(contract.id, unit.id);
    const response = await mutate(operation, contract.id, { ...terms, reservationId: reservation.id }, { cookie: "" });
    expect(response.status).toBe(401);
    expect(await readJson(response)).toMatchObject({ error: { code: "UNAUTHORIZED" } });
    expect(await state(contract.id, unit.id)).toEqual(before);
  });

  it.each(["edit", "approve"] as const)("%s malformed path id precedes body validation → 404", async (operation) => {
    const response = await mutate(operation, "not-a-uuid", {});
    expect(response.status).toBe(404);
    expect(await readJson(response)).toMatchObject({ error: { code: "NOT_FOUND" } });
  });

  it.each(["create", "edit", "approve"] as const)("%s malformed JSON → 400", async (operation) => {
    const { contract, unit } = await draftFixture();
    const before = await state(contract.id, unit.id);
    const response = await mutate(operation, contract.id, "{");
    expect(response.status).toBe(400);
    expect(await readJson(response)).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    expect(await state(contract.id, unit.id)).toEqual(before);
  });

  it("POST creates a draft, PATCH edits it, POST /approve stores its schedule", async () => {
    const { reservation, unit } = await reservationFixture();
    const response = await mutate("create", reservation.id, {
      ...terms,
      reservationId: reservation.id,
      companyId: companies.b.companyId,
      approvedAt: new Date().toISOString(),
      status: "APPROVED",
      schedule: [{ seq: 0, amount: 1 }],
    });
    expect(response.status).toBe(201);
    expect(await readJson(response)).toMatchObject({ data: {
      status: "DRAFT", finalPrice: terms.finalPrice, approvedAt: null,
      schedule: { estimated: true },
    } });
    const contract = await getDb().contract.findUniqueOrThrow({ where: { reservationId: reservation.id } });
    expect(contract.companyId).toBe(companies.a.companyId);
    expect(await getDb().installment.count({ where: { contractId: contract.id } })).toBe(0);
    const edited = { ...terms, finalPrice: 11_000_000 };
    const edit = await mutate("edit", contract.id, edited);
    expect(edit.status).toBe(200);
    expect(await readJson(edit)).toMatchObject({ data: { ...edited, status: "DRAFT" } });
    cookie = await sessionCookie(companies.a.accountant.userId);
    const approval = await mutate("approve", contract.id, edited);
    expect(approval.status).toBe(200);
    expect(await readJson(approval)).toMatchObject({ data: {
      ...edited, status: "APPROVED", approvedAt: expect.any(String),
      startDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      schedule: { estimated: false },
    } });
    const stored = await state(contract.id, unit.id);
    expect(stored.unit.status).toBe("SOLD");
    expect(stored.installments).toBe(edited.installmentCount + 1);
    expect(stored.audit).toBe(1);
  });
});

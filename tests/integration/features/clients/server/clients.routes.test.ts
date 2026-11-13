import { beforeEach, describe, expect, it } from "vitest";

import { GET, POST } from "@/app/api/clients/route";
import { GET as getClientHandler, PATCH } from "@/app/api/clients/[id]/route";
import { getDb } from "@/server/db";
import { makeClient, makeSession } from "../../../support/db-fixtures";
import { apiRequest, readJson } from "../../../support/http";
import { makeTwoCompanies } from "../../../support/session-users";

let companies: Awaited<ReturnType<typeof makeTwoCompanies>>;
let cookie: string;
const input = { name: "عميل جديد", phone: "0500000000", notes: "ملاحظات" };

beforeEach(async () => {
  companies = await makeTwoCompanies();
  await signIn("sales1");
});

async function signIn(role: "sales1" | "accountant" | "manager") {
  const token = await makeSession(companies.a[role].userId, new Date(Date.now() + 86_400_000));
  cookie = `aqar_session=${token}`;
}

function detail(id: string) {
  return getClientHandler(apiRequest(`/api/clients/${id}`, { method: "GET", cookie }), {
    params: Promise.resolve({ id }),
  });
}

function patch(id: string, body: unknown = input) {
  return PATCH(apiRequest(`/api/clients/${id}`, { method: "PATCH", cookie, body }), {
    params: Promise.resolve({ id }),
  });
}

function list(query = "") {
  return GET(apiRequest(`/api/clients${query}`, { method: "GET", cookie }), undefined);
}

describe("clients routes", () => {
  it("GET /api/clients/{other rep's id} as SALES returns 404", async () => {
    const other = await makeClient(companies.a.companyId, companies.a.sales2.userId);
    const response = await detail(other.id);
    expect(response.status).toBe(404);
    expect(await readJson(response)).toMatchObject({ error: { code: "NOT_FOUND" } });
  });
  it("POST /api/clients with a valid body returns 201 with salesRep = session user", async () => {
    const response = await POST(
      apiRequest("/api/clients", {
        method: "POST",
        cookie,
        body: { ...input, companyId: companies.b.companyId, salesRepId: companies.b.sales1.userId },
      }),
      undefined,
    );
    expect(response.status).toBe(201);
    const body = await readJson(response);
    expect(body).toEqual({
      data: {
        id: expect.any(String),
        ...input,
        salesRep: { id: companies.a.sales1.userId, name: companies.a.sales1.name },
      },
    });
    expect(await getDb().client.count({ where: { companyId: companies.a.companyId } })).toBe(1);
    expect(await getDb().client.count({ where: { companyId: companies.b.companyId } })).toBe(0);
  });
  it("GET /api/clients returns own clients", async () => {
    const own = await makeClient(companies.a.companyId, companies.a.sales1.userId);
    const response = await list();
    expect(response.status).toBe(200);
    expect(await readJson(response)).toMatchObject({ data: { items: [{ id: own.id }], total: 1 } });
  });
  it("PATCH own client returns updated DTO", async () => {
    const own = await makeClient(companies.a.companyId, companies.a.sales1.userId);
    const response = await patch(own.id);
    expect(response.status).toBe(200);
    expect(await readJson(response)).toMatchObject({ data: { id: own.id, ...input } });
  });
});

describe("client permissions and validation", () => {
  it.each(["manager", "accountant"] as const)(
    "PATCH /api/clients/{id} with a valid body as %s returns 403",
    async (role) => {
      await signIn(role);
      const own = await makeClient(companies.a.companyId, companies.a.sales1.userId);
      const response = await patch(own.id);
      expect(response.status).toBe(403);
      expect(await readJson(response)).toMatchObject({ error: { code: "FORBIDDEN" } });
      expect(await getDb().client.findUnique({ where: { id: own.id } })).toEqual(own);
    },
  );
  it.each(["manager", "accountant"] as const)(
    "POST /api/clients as %s returns 403",
    async (role) => {
      await signIn(role);
      const response = await POST(
        apiRequest("/api/clients", { method: "POST", cookie, body: input }),
        undefined,
      );
      expect(response.status).toBe(403);
      expect(await readJson(response)).toMatchObject({ error: { code: "FORBIDDEN" } });
      expect(await getDb().client.count({ where: { companyId: companies.a.companyId } })).toBe(0);
    },
  );
  it.each(["{", { ...input, name: "" }, { ...input, phone: "letters" }])(
    "POST invalid body returns 400: %j",
    async (body) => {
      const response = await POST(
        apiRequest("/api/clients", { method: "POST", cookie, body }),
        undefined,
      );
      expect(response.status).toBe(400);
      expect(await readJson(response)).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
      expect(await getDb().client.count({ where: { companyId: companies.a.companyId } })).toBe(0);
    },
  );
  it("PATCH invalid body returns 400 fieldErrors without changing client", async () => {
    const own = await makeClient(companies.a.companyId, companies.a.sales1.userId);
    const response = await patch(own.id, { ...input, name: "" });
    expect(response.status).toBe(400);
    expect(await readJson(response)).toMatchObject({
      error: { code: "VALIDATION_ERROR", fieldErrors: { name: [expect.any(String)] } },
    });
    expect(await getDb().client.findUnique({ where: { id: own.id } })).toEqual(own);
  });
  it.each(["?page=0", "?pageSize=51"])("GET invalid query returns 400: %s", async (query) => {
    const response = await list(query);
    expect(response.status).toBe(400);
    expect(await readJson(response)).toMatchObject({
      error: { code: "VALIDATION_ERROR", fieldErrors: expect.any(Object) },
    });
  });
  it("GET without a session returns 401", async () => {
    const response = await GET(apiRequest("/api/clients", { method: "GET" }), undefined);
    expect(response.status).toBe(401);
  });
  it("POST with foreign Origin returns 403 INVALID_ORIGIN", async () => {
    const response = await POST(
      apiRequest("/api/clients", {
        method: "POST",
        cookie,
        body: input,
        origin: "https://foreign.test",
      }),
      undefined,
    );
    expect(response.status).toBe(403);
    expect(await readJson(response)).toMatchObject({ error: { code: "INVALID_ORIGIN" } });
    expect(await getDb().client.count({ where: { companyId: companies.a.companyId } })).toBe(0);
  });
  it("PATCH non-UUID returns 404 before body validation", async () => {
    const response = await patch("not-a-uuid", "{");
    expect(response.status).toBe(404);
    expect(await readJson(response)).toMatchObject({ error: { code: "NOT_FOUND" } });
  });
});

describe("tenant isolation", () => {
  it.each(["manager", "sales1", "accountant"] as const)(
    "GET company B client returns 404 for %s",
    async (role) => {
      await signIn(role);
      const foreign = await makeClient(companies.b.companyId, companies.b.sales1.userId);
      const response = await detail(foreign.id);
      expect(response.status).toBe(404);
      expect(await readJson(response)).toMatchObject({ error: { code: "NOT_FOUND" } });
    },
  );

  it("GET /api/clients/not-a-uuid returns 404", async () => {
    const response = await detail("not-a-uuid");
    expect(response.status).toBe(404);
    expect(await readJson(response)).toMatchObject({ error: { code: "NOT_FOUND" } });
  });

  it("PATCH company B client with a valid body returns 404 for SALES", async () => {
    const foreign = await makeClient(companies.b.companyId, companies.b.sales1.userId);
    const response = await patch(foreign.id);
    expect(response.status).toBe(404);
    expect(await readJson(response)).toMatchObject({ error: { code: "NOT_FOUND" } });
    expect(await getDb().client.findUnique({ where: { id: foreign.id } })).toEqual(foreign);
  });

  it.each(["manager", "sales1", "accountant"] as const)(
    "GET ?companyId=company B returns only company A rows for %s",
    async (role) => {
      await signIn(role);
      const own = await makeClient(companies.a.companyId, companies.a.sales1.userId);
      await makeClient(companies.b.companyId, companies.b.sales1.userId);
      const response = await list(`?companyId=${companies.b.companyId}`);
      expect(response.status).toBe(200);
      expect(await readJson(response)).toMatchObject({
        data: { items: [{ id: own.id }], total: 1, page: 1, pageSize: 20 },
      });
    },
  );
});

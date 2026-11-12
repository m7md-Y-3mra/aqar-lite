import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";

import { meHandler } from "@/features/auth/server/auth.routes";
import { getDb } from "@/server/db";
import { makeCompany, makeSession, makeUserWithPassword } from "../../support/db-fixtures";
import { apiRequest, readJson } from "../../support/http";

let company: Awaited<ReturnType<typeof makeCompany>>;
let user: Awaited<ReturnType<typeof makeUserWithPassword>>["user"];

function getMe(token?: string) {
  return meHandler(
    apiRequest("/api/auth/me", {
      method: "GET",
      cookie: token === undefined ? undefined : `aqar_session=${token}`,
    }),
    undefined,
  );
}

beforeEach(async () => {
  company = await makeCompany();
  ({ user } = await makeUserWithPassword(company.id, "session-gate-password"));
});

describe("GET /api/auth/me", () => {
  it("returns exactly the shell user for a valid session", async () => {
    const token = await makeSession(user.id, new Date(Date.now() + 86_400_000));
    const response = await getMe(token);
    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({
      data: { name: user.name, role: user.role, companyName: company.name },
    });
  });

  it("returns identical unauthorized bodies for missing, random, empty and expired tokens", async () => {
    const expired = await makeSession(user.id, new Date(Date.now() - 1_000));
    const bodies: unknown[] = [];
    for (const token of [undefined, randomBytes(32).toString("base64url"), "", expired]) {
      const response = await getMe(token);
      expect(response.status).toBe(401);
      const body = await readJson(response);
      expect(body).toEqual({ error: { code: "UNAUTHORIZED", message: "يجب تسجيل الدخول أولاً" } });
      expect(body).not.toHaveProperty("data");
      bodies.push(body);
    }
    for (const body of bodies) expect(body).toEqual(bodies[0]);
  });

  it("resolves each company's identity only from its own session", async () => {
    const otherCompany = await makeCompany();
    const other = await makeUserWithPassword(otherCompany.id, "other-password", "ACCOUNTANT");
    const namedOtherCompany = await getDb().company.update({
      where: { id: otherCompany.id },
      data: { name: "شركة أخرى" },
    });
    for (const [account, tenant, excluded] of [
      [user, company, namedOtherCompany],
      [other.user, namedOtherCompany, company],
    ] as const) {
      const token = await makeSession(account.id, new Date(Date.now() + 86_400_000));
      const response = await getMe(token);
      expect(response.status).toBe(200);
      const body = await readJson(response);
      expect(body).toEqual({
        data: { name: account.name, role: account.role, companyName: tenant.name },
      });
      expect(JSON.stringify(body)).not.toContain(excluded.name);
    }
  });
});

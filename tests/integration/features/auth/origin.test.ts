import { beforeEach, describe, expect, it } from "vitest";

import { loginHandler, logoutHandler, meHandler } from "@/features/auth/server/auth.routes";
import { getDb } from "@/server/db";
import { makeCompany, makeSession, makeUserWithPassword } from "../../support/db-fixtures";
import { apiRequest, readJson } from "../../support/http";

const PASSWORD = "origin-password";
const OWN_ORIGIN = "http://localhost:3000";
const FOREIGN_ORIGIN = "https://evil.test";
let user: Awaited<ReturnType<typeof makeUserWithPassword>>["user"];
let email: string;

function postLogin(origin: string | null) {
  return loginHandler(
    apiRequest("/api/auth/login", {
      method: "POST",
      origin,
      body: { email, password: PASSWORD },
    }),
    undefined,
  );
}

function postLogout(token: string, origin: string) {
  return logoutHandler(
    apiRequest("/api/auth/logout", {
      method: "POST",
      origin,
      cookie: `aqar_session=${token}`,
    }),
    undefined,
  );
}

function getMe(token?: string, origin = OWN_ORIGIN) {
  return meHandler(
    apiRequest("/api/auth/me", {
      method: "GET",
      origin,
      cookie: token === undefined ? undefined : `aqar_session=${token}`,
    }),
    undefined,
  );
}

beforeEach(async () => {
  const company = await makeCompany();
  ({ user, email } = await makeUserWithPassword(company.id, PASSWORD));
});

describe("auth origin protection", () => {
  it.each([FOREIGN_ORIGIN, null, "http://localhost:3000.evil.test", "http://localhost:3001"])(
    "rejects login from %s without cookies, sessions or audits",
    async (origin) => {
      const sessionsBefore = await getDb().session.count();
      const auditsBefore = await getDb().auditLog.count();
      const response = await postLogin(origin);
      expect(response.status).toBe(403);
      expect(await readJson(response)).toMatchObject({ error: { code: "INVALID_ORIGIN" } });
      expect(response.headers.get("set-cookie")).toBeNull();
      await expect(getDb().session.count()).resolves.toBe(sessionsBefore);
      await expect(getDb().auditLog.count()).resolves.toBe(auditsBefore);
    },
  );

  it("accepts login from the exact app origin", async () => {
    const response = await postLogin(OWN_ORIGIN);
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("aqar_session=");
    await expect(getDb().session.count({ where: { userId: user.id } })).resolves.toBe(1);
  });

  it("refuses foreign logout without ending the session", async () => {
    const token = await makeSession(user.id, new Date(Date.now() + 86_400_000));
    const response = await postLogout(token, FOREIGN_ORIGIN);
    expect(response.status).toBe(403);
    expect(await readJson(response)).toMatchObject({ error: { code: "INVALID_ORIGIN" } });
    expect(response.headers.get("set-cookie")).toBeNull();
    expect((await getMe(token)).status).toBe(200);
  });

  it("allows own-origin logout and invalidates the session", async () => {
    const token = await makeSession(user.id, new Date(Date.now() + 86_400_000));
    const response = await postLogout(token, OWN_ORIGIN);
    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({ data: { ok: true } });
    const replay = await getMe(token);
    expect(replay.status).toBe(401);
    expect(await readJson(replay)).toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });

  it("does not origin-check GET, but still requires a session", async () => {
    const token = await makeSession(user.id, new Date(Date.now() + 86_400_000));
    const response = await getMe(token, FOREIGN_ORIGIN);
    expect(response.status).toBe(200);
    expect(await readJson(response)).toMatchObject({ data: { name: user.name } });
    const anonymous = await getMe(undefined, FOREIGN_ORIGIN);
    expect(anonymous.status).toBe(401);
    expect(await readJson(anonymous)).toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });
});

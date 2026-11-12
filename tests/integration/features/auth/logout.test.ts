import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";

import { loginHandler, logoutHandler, meHandler } from "@/features/auth/server/auth.routes";
import { hashSessionToken } from "@/server/auth/session-token";
import { getDb } from "@/server/db";
import { makeCompany, makeUserWithPassword } from "../../support/db-fixtures";
import { apiRequest, getSetCookie, readJson } from "../../support/http";

const PASSWORD = "logout-password";
let user: Awaited<ReturnType<typeof makeUserWithPassword>>["user"];
let email: string;

async function loginToken() {
  const response = await loginHandler(
    apiRequest("/api/auth/login", {
      method: "POST",
      body: { email, password: PASSWORD },
    }),
    undefined,
  );
  expect(response.status).toBe(200);
  const token = /^aqar_session=([A-Za-z0-9_-]{43});/.exec(getSetCookie(response))?.[1];
  if (!token) throw new Error("Expected a login session cookie");
  return token;
}

function getMe(token: string) {
  return meHandler(
    apiRequest("/api/auth/me", { method: "GET", cookie: `aqar_session=${token}` }),
    undefined,
  );
}

function postLogout(token?: string) {
  return logoutHandler(
    apiRequest("/api/auth/logout", {
      method: "POST",
      cookie: token === undefined ? undefined : `aqar_session=${token}`,
    }),
    undefined,
  );
}

async function expectCleared(response: Response) {
  expect(response.status).toBe(200);
  expect(await readJson(response)).toEqual({ data: { ok: true } });
  const cookie = getSetCookie(response);
  expect(cookie).toContain("aqar_session=;");
  for (const attribute of ["Max-Age=0", "Path=/", "HttpOnly", "Secure", "SameSite=Lax"]) {
    expect(cookie).toContain(attribute);
  }
}

beforeEach(async () => {
  const company = await makeCompany();
  ({ user, email } = await makeUserWithPassword(company.id, PASSWORD));
});

describe("POST /api/auth/logout", () => {
  it("deletes the server session and rejects replay of the raw login token", async () => {
    const token = await loginToken();
    expect((await getMe(token)).status).toBe(200);
    await expectCleared(await postLogout(token));
    await expect(
      getDb().session.findUnique({ where: { id: hashSessionToken(token) } }),
    ).resolves.toBeNull();
    const replay = await getMe(token);
    expect(replay.status).toBe(401);
    expect(await readJson(replay)).toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });

  it("ends only the current session, not another session of the same user", async () => {
    const first = await loginToken();
    const second = await loginToken();
    await expectCleared(await postLogout(first));
    expect((await getMe(first)).status).toBe(401);
    expect((await getMe(second)).status).toBe(200);
    await expect(getDb().session.count({ where: { userId: user.id } })).resolves.toBe(1);
  });

  it("succeeds and clears the cookie when no cookie was sent", async () => {
    await expectCleared(await postLogout());
  });

  it("succeeds for a random token without deleting any other session", async () => {
    const token = await loginToken();
    const before = await getDb().session.count();
    await expectCleared(await postLogout(randomBytes(32).toString("base64url")));
    await expect(getDb().session.count()).resolves.toBe(before);
    expect((await getMe(token)).status).toBe(200);
  });
});

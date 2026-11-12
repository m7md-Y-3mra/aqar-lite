import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  buildClearedSessionCookie,
  buildSessionCookie,
  generateSessionToken,
  hashSessionToken,
  readSessionToken,
  SESSION_COOKIE,
  sessionExpiresAt,
  SESSION_TTL_MS,
} from "@/server/auth/session-token";

describe("session token", () => {
  it("generates distinct 32-byte base64url tokens", () => {
    const first = generateSessionToken();
    const second = generateSessionToken();

    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first).not.toBe(second);
  });

  it("hashes a token as lowercase SHA-256 hex", () => {
    const token = "fixture-token";
    const expected = createHash("sha256").update(token).digest("hex");

    expect(hashSessionToken(token)).toBe(expected);
    expect(hashSessionToken(token)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("expires a session seven days after the supplied time", () => {
    const now = new Date("2026-11-12T10:00:00.000Z");

    expect(SESSION_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
    expect(sessionExpiresAt(now)).toEqual(new Date(now.getTime() + SESSION_TTL_MS));
  });

  it("builds the secure session cookie", () => {
    expect(buildSessionCookie("token-value")).toBe(
      "aqar_session=token-value; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax",
    );
  });

  it("builds the cleared session cookie with the same attributes", () => {
    expect(buildClearedSessionCookie()).toBe(
      "aqar_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
    );
  });

  it("reads the session token from a header with several cookies", () => {
    expect(readSessionToken(`theme=dark; ${SESSION_COOKIE}=token-value; locale=ar`)).toBe(
      "token-value",
    );
  });

  it("ignores missing, empty, and oversized values", () => {
    expect(readSessionToken(null)).toBeNull();
    expect(readSessionToken("theme=dark")).toBeNull();
    expect(readSessionToken(`${SESSION_COOKIE}=`)).toBeNull();
    expect(readSessionToken(`${SESSION_COOKIE}=${"x".repeat(129)}`)).toBeNull();
  });
});

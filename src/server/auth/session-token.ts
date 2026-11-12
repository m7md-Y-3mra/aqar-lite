import "server-only";

import { createHash, randomBytes } from "node:crypto";

export const SESSION_COOKIE = "aqar_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const SESSION_MAX_AGE_SECONDS = SESSION_TTL_MS / 1000;

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionExpiresAt(now: Date): Date {
  return new Date(now.getTime() + SESSION_TTL_MS);
}

export function buildSessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
}

export function buildClearedSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export function readSessionToken(cookieHeader: string | null): string | null {
  if (cookieHeader === null) return null;

  for (const cookie of cookieHeader.split(";")) {
    const separator = cookie.indexOf("=");
    if (separator === -1 || cookie.slice(0, separator).trim() !== SESSION_COOKIE) continue;

    const token = cookie.slice(separator + 1).trim();
    return token.length > 0 && token.length <= 128 ? token : null;
  }

  return null;
}

import "server-only";

import type { LoginInput } from "@/features/auth/auth.types";
import { countRecentLoginFailures, insertAuditLog } from "@/server/audit/audit.repository";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "@/server/auth/password";
import { createSession, deleteSession } from "@/server/auth/session.repository";
import { toShellUser, type SessionUser } from "@/server/auth/session.service";
import {
  generateSessionToken,
  hashSessionToken,
  sessionExpiresAt,
} from "@/server/auth/session-token";
import { withTransaction } from "@/server/db";
import { AppError } from "@/server/http/app-error";
import type { ShellUser } from "@/shared/components/current-user";
import { findUserByEmail, lockLoginEmail } from "./auth.repository";

const LOGIN_LOCK_THRESHOLD = 5;
const LOGIN_LOCK_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_FAILURE_REASON = {
  invalidCredentials: "invalid_credentials",
  locked: "locked",
} as const;

export async function logout(token: string | null): Promise<void> {
  if (token) await deleteSession(hashSessionToken(token));
}

export function me(user: SessionUser): ShellUser {
  return toShellUser(user);
}

type LoginResult = { ok: false } | { ok: true; token: string; user: ShellUser };

export async function login(input: LoginInput, now = new Date()) {
  const result: LoginResult = await withTransaction(async (tx) => {
    await lockLoginEmail(input.email, tx);
    const failures = await countRecentLoginFailures(
      input.email,
      new Date(now.getTime() - LOGIN_LOCK_WINDOW_MS),
      tx,
    );
    const user = await findUserByEmail(input.email, tx);
    const auditIdentity = {
      action: "LOGIN_FAILED" as const,
      companyId: user?.companyId ?? null,
      userId: user?.id ?? null,
      createdAt: now,
    };

    if (failures >= LOGIN_LOCK_THRESHOLD) {
      await verifyPassword(DUMMY_PASSWORD_HASH, input.password);
      await insertAuditLog(
        {
          ...auditIdentity,
          meta: { email: input.email, reason: LOGIN_FAILURE_REASON.locked },
        },
        tx,
      );
      return { ok: false };
    }
    const ok = user
      ? await verifyPassword(user.passwordHash, input.password)
      : (await verifyPassword(DUMMY_PASSWORD_HASH, input.password), false);

    if (!ok || user === null) {
      await insertAuditLog(
        {
          ...auditIdentity,
          meta: { email: input.email, reason: LOGIN_FAILURE_REASON.invalidCredentials },
        },
        tx,
      );
      return { ok: false };
    }

    const token = generateSessionToken();
    await createSession(
      {
        id: hashSessionToken(token),
        userId: user.id,
        expiresAt: sessionExpiresAt(now),
      },
      tx,
    );

    return {
      ok: true,
      token,
      user: {
        name: user.name,
        role: user.role,
        companyName: user.company.name,
      },
    };
  });

  if (!result.ok) throw new AppError("INVALID_CREDENTIALS");

  return { token: result.token, user: result.user };
}

import "server-only";

import type { LoginInput } from "@/features/auth/auth.types";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "@/server/auth/password";
import { createSession } from "@/server/auth/session.repository";
import {
  generateSessionToken,
  hashSessionToken,
  sessionExpiresAt,
} from "@/server/auth/session-token";
import { withTransaction } from "@/server/db";
import { AppError } from "@/server/http/app-error";
import type { ShellUser } from "@/shared/components/current-user";
import { findUserByEmail } from "./auth.repository";

type LoginResult = { ok: false } | { ok: true; token: string; user: ShellUser };

export async function login(input: LoginInput, now = new Date()) {
  const result: LoginResult = await withTransaction(async (tx) => {
    const user = await findUserByEmail(input.email, tx);
    const ok = user
      ? await verifyPassword(user.passwordHash, input.password)
      : (await verifyPassword(DUMMY_PASSWORD_HASH, input.password), false);

    if (!ok || user === null) return { ok: false };

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

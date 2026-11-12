import "server-only";

import type { Role } from "@/shared/lib/roles";
import { findSessionWithUser } from "./session.repository";
import { hashSessionToken } from "./session-token";

export type SessionUser = {
  userId: string;
  companyId: string;
  role: Role;
  name: string;
  companyName: string;
};

export async function getSessionUser(
  token: string | null,
  now = new Date(),
): Promise<SessionUser | null> {
  if (token === null) return null;

  const session = await findSessionWithUser(hashSessionToken(token));
  if (session === null || session.expiresAt <= now) return null;

  return {
    userId: session.user.id,
    companyId: session.user.companyId,
    role: session.user.role,
    name: session.user.name,
    companyName: session.user.company.name,
  };
}

export function toShellUser(user: SessionUser) {
  return {
    name: user.name,
    role: user.role,
    companyName: user.companyName,
  };
}

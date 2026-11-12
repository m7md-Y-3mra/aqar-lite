import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { getSessionUser } from "./session.service";
import { SESSION_COOKIE } from "./session-token";

export const getCurrentUser = cache(async () =>
  getSessionUser((await cookies()).get(SESSION_COOKIE)?.value ?? null),
);

export async function requireUser() {
  const user = await getCurrentUser();
  if (user === null) redirect("/login");
  return user;
}

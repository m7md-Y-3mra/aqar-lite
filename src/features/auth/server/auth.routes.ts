import "server-only";

import { loginSchema } from "@/features/auth/auth.schemas";
import {
  buildClearedSessionCookie,
  buildSessionCookie,
  readSessionToken,
} from "@/server/auth/session-token";
import { handleRoute, readJson } from "@/server/http/route-handler";
import { login, logout, me } from "./auth.service";

export const logoutHandler = handleRoute({
  auth: "public",
  handler: async (req) => {
    await logout(readSessionToken(req.headers.get("cookie")));
    return Response.json(
      { data: { ok: true } },
      { headers: { "Set-Cookie": buildClearedSessionCookie() } },
    );
  },
});

export const meHandler = handleRoute({
  auth: "user",
  handler: (req, ctx, user) => ({ data: me(user) }),
});

export const loginHandler = handleRoute({
  auth: "public",
  handler: async (req) => {
    const input = loginSchema.parse(await readJson(req));
    const { token, user } = await login(input);

    return Response.json({ data: user }, { headers: { "Set-Cookie": buildSessionCookie(token) } });
  },
});

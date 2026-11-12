import "server-only";

import { loginSchema } from "@/features/auth/auth.schemas";
import { buildSessionCookie } from "@/server/auth/session-token";
import { handleRoute, readJson } from "@/server/http/route-handler";
import { login } from "./auth.service";

export const loginHandler = handleRoute({
  auth: "public",
  handler: async (req) => {
    const input = loginSchema.parse(await readJson(req));
    const { token, user } = await login(input);

    return Response.json({ data: user }, { headers: { "Set-Cookie": buildSessionCookie(token) } });
  },
});

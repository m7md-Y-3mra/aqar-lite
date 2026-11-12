import "server-only";

import { getSessionUser } from "./session.service";
import { readSessionToken } from "./session-token";

export function getRequestUser(req: Request) {
  return getSessionUser(readSessionToken(req.headers.get("cookie")));
}

import "server-only";

import { handleRoute } from "@/server/http/route-handler";
import { toQueryInput } from "@/shared/lib/search-params";
import { auditLogListQuerySchema } from "../audit-log.schemas";
import { listAuditLog } from "./audit-log.service";

export const listAuditLogHandler = handleRoute({
  auth: "user",
  handler: async (req, ctx, user) => {
    const query = auditLogListQuerySchema.parse(toQueryInput(new URL(req.url).searchParams));
    return { data: await listAuditLog(user, query) };
  },
});

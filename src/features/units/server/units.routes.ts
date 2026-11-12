import "server-only";

import { AppError } from "@/server/http/app-error";
import { handleRoute } from "@/server/http/route-handler";
import { toQueryInput } from "@/shared/lib/search-params";
import { unitIdSchema, unitListQuerySchema } from "../units.schemas";
import { getUnit, listUnits } from "./units.service";

export const listUnitsHandler = handleRoute({
  auth: "user",
  handler: async (req, ctx, user) => {
    const query = unitListQuerySchema.parse(toQueryInput(new URL(req.url).searchParams));
    return { data: await listUnits(user, query) };
  },
});

export const getUnitHandler = handleRoute<{ params: Promise<{ id: string }> }>({
  auth: "user",
  handler: async (req, ctx, user) => {
    const params = await ctx.params;
    const parsed = unitIdSchema.safeParse(params.id);
    if (!parsed.success) throw new AppError("NOT_FOUND");
    return { data: await getUnit(user, parsed.data) };
  },
});

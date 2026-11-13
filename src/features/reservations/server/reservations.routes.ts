import "server-only";

import { handleRoute, readJson } from "@/server/http/route-handler";
import { toQueryInput } from "@/shared/lib/search-params";
import { reserveInputSchema, reserveOptionsQuerySchema } from "../reservations.schemas";
import { getReserveOptions, reserveUnit } from "./reservations.service";

export const reserveHandler = handleRoute({
  auth: "user",
  handler: async (req, ctx, user) => {
    const input = reserveInputSchema.parse(await readJson(req));
    return { data: await reserveUnit(user, input), status: 201 };
  },
});

export const reserveOptionsHandler = handleRoute({
  auth: "user",
  handler: async (req, ctx, user) => {
    const query = reserveOptionsQuerySchema.parse(toQueryInput(new URL(req.url).searchParams));
    return { data: await getReserveOptions(user, query.unitId) };
  },
});

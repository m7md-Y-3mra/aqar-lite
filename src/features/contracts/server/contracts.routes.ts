import "server-only";

import { AppError } from "@/server/http/app-error";
import { handleRoute } from "@/server/http/route-handler";
import { toQueryInput } from "@/shared/lib/search-params";
import {
  contractIdSchema,
  contractListQuerySchema,
  contractOptionsQuerySchema,
} from "../contracts.schemas";
import { getContract, getContractOptions, listContracts } from "./contracts.service";

export const getContractHandler = handleRoute<{ params: Promise<{ id: string }> }>({
  auth: "user",
  handler: async (req, ctx, user) => {
    const parsed = contractIdSchema.safeParse((await ctx.params).id);
    if (!parsed.success) throw new AppError("NOT_FOUND");
    return { data: await getContract(user, parsed.data) };
  },
});

export const listContractsHandler = handleRoute({
  auth: "user",
  handler: async (req, ctx, user) => {
    const query = contractListQuerySchema.parse(toQueryInput(new URL(req.url).searchParams));
    return { data: await listContracts(user, query) };
  },
});

export const contractOptionsHandler = handleRoute({
  auth: "user",
  handler: async (req, ctx, user) => {
    const query = contractOptionsQuerySchema.parse(toQueryInput(new URL(req.url).searchParams));
    return { data: await getContractOptions(user, query.reservationId) };
  },
});

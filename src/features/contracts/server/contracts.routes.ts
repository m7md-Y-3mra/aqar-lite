import "server-only";

import { AppError } from "@/server/http/app-error";
import { handleRoute, readJson } from "@/server/http/route-handler";
import { toQueryInput } from "@/shared/lib/search-params";
import {
  contractTermsInputSchema,
  createContractInputSchema,
  contractIdSchema,
  contractListQuerySchema,
  contractOptionsQuerySchema,
} from "../contracts.schemas";
import { approveContract, createContract, updateContract, getContract, getContractOptions, listContracts } from "./contracts.service";

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

export const createContractHandler = handleRoute({
  auth: "user",
  handler: async (req, ctx, user) => {
    const input = createContractInputSchema.parse(await readJson(req));
    return { data: await createContract(user, input), status: 201 };
  },
});

export const updateContractHandler = handleRoute<{ params: Promise<{ id: string }> }>({
  auth: "user",
  handler: async (req, ctx, user) => {
    const parsed = contractIdSchema.safeParse((await ctx.params).id);
    if (!parsed.success) throw new AppError("NOT_FOUND");
    const input = contractTermsInputSchema.parse(await readJson(req));
    return { data: await updateContract(user, parsed.data, input) };
  },
});

export const approveContractHandler = handleRoute<{ params: Promise<{ id: string }> }>({
  auth: "user",
  handler: async (req, ctx, user) => {
    const parsed = contractIdSchema.safeParse((await ctx.params).id);
    if (!parsed.success) throw new AppError("NOT_FOUND");
    const seen = contractTermsInputSchema.parse(await readJson(req));
    return { data: await approveContract(user, parsed.data, seen) };
  },
});

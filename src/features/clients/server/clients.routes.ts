import "server-only";

import { AppError } from "@/server/http/app-error";
import { handleRoute, readJson } from "@/server/http/route-handler";
import { toQueryInput } from "@/shared/lib/search-params";
import { clientIdSchema, clientInputSchema, clientListQuerySchema } from "../clients.schemas";
import { createClient, getClient, listClients, updateClient } from "./clients.service";

export const listClientsHandler = handleRoute({
  auth: "user",
  handler: async (req, ctx, user) => {
    const query = clientListQuerySchema.parse(toQueryInput(new URL(req.url).searchParams));
    return { data: await listClients(user, query) };
  },
});

export const createClientHandler = handleRoute({
  auth: "user",
  handler: async (req, ctx, user) => {
    const input = clientInputSchema.parse(await readJson(req));
    return { data: await createClient(user, input), status: 201 };
  },
});

export const updateClientHandler = handleRoute<{ params: Promise<{ id: string }> }>({
  auth: "user",
  handler: async (req, ctx, user) => {
    const params = await ctx.params;
    const parsed = clientIdSchema.safeParse(params.id);
    if (!parsed.success) throw new AppError("NOT_FOUND");
    const input = clientInputSchema.parse(await readJson(req));
    return { data: await updateClient(user, parsed.data, input) };
  },
});

export const getClientHandler = handleRoute<{ params: Promise<{ id: string }> }>({
  auth: "user",
  handler: async (req, ctx, user) => {
    const params = await ctx.params;
    const parsed = clientIdSchema.safeParse(params.id);
    if (!parsed.success) throw new AppError("NOT_FOUND");
    return { data: await getClient(user, parsed.data) };
  },
});

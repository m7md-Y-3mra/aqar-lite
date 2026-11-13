import "server-only";

import { AppError } from "@/server/http/app-error";
import { handleRoute, readJson } from "@/server/http/route-handler";
import {
  idempotencyKeySchema,
  paymentContractIdSchema,
  recordPaymentInputSchema,
} from "../payments.schemas";
import { listPayments, recordPayment } from "./payments.service";

type ContractRouteContext = { params: Promise<{ id: string }> };

async function parseContractId(ctx: ContractRouteContext) {
  const parsed = paymentContractIdSchema.safeParse((await ctx.params).id);
  if (!parsed.success) throw new AppError("NOT_FOUND");
  return parsed.data;
}

export const listPaymentsHandler = handleRoute<ContractRouteContext>({
  auth: "user",
  handler: async (_req, ctx, user) => ({
    data: await listPayments(user, await parseContractId(ctx)),
  }),
});

export const recordPaymentHandler = handleRoute<ContractRouteContext>({
  auth: "user",
  handler: async (req, ctx, user) => {
    const contractId = await parseContractId(ctx);
    const key = idempotencyKeySchema.safeParse(req.headers.get("Idempotency-Key"));
    if (!key.success) {
      throw new AppError("VALIDATION_ERROR", {
        idempotencyKey: key.error.issues.map((issue) => issue.message),
      });
    }
    const input = recordPaymentInputSchema.parse(await readJson(req));
    const { payment, replayed } = await recordPayment(user, contractId, input, key.data);
    return { data: payment, status: replayed ? 200 : 201 };
  },
});

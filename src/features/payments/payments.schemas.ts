import { z } from "zod";

export const MAX_IDEMPOTENCY_KEY_LENGTH = 100;

export const paymentContractIdSchema = z.uuid({ error: "معرّف العقد غير صحيح" });

export const paymentSchema = z.object({
  amount: z
    .number({ error: "أدخل مبلغاً صحيحاً" })
    .int("المبلغ يجب أن يكون عدداً صحيحاً بالهللات")
    .min(1, "المبلغ يجب أن يكون أكبر من صفر")
    .max(100_000_000_000, "المبلغ يجب ألا يتجاوز مليار ريال"),
});

export const recordPaymentInputSchema = paymentSchema.pick({ amount: true });

export const idempotencyKeySchema = z
  .string({ error: "مفتاح الطلب مطلوب" })
  .trim()
  .min(1, "مفتاح الطلب مطلوب")
  .max(MAX_IDEMPOTENCY_KEY_LENGTH, "مفتاح الطلب طويل جداً");

import { z } from "zod";

import { paginationFields } from "@/shared/lib/pagination";

export const clientIdSchema = z.uuid({ error: "معرّف العميل غير صحيح" });

export const clientSchema = z.object({
  name: z
    .string({ error: "أدخل اسم العميل" })
    .trim()
    .min(1, "اسم العميل مطلوب")
    .max(100, "اسم العميل يجب ألا يتجاوز ١٠٠ حرف"),
  phone: z
    .string({ error: "أدخل رقم الهاتف" })
    .trim()
    .min(7, "رقم الهاتف يجب ألا يقل عن ٧ أحرف")
    .max(20, "رقم الهاتف يجب ألا يتجاوز ٢٠ حرفاً")
    .regex(/^\+?[0-9][0-9 -]{5,18}$/, "أدخل رقم هاتف صحيحاً"),
  notes: z
    .string({ error: "أدخل ملاحظات صحيحة" })
    .trim()
    .max(2000, "الملاحظات يجب ألا تتجاوز ٢٠٠٠ حرف")
    .nullable()
    .optional()
    .transform((value) => value || null),
});

export const clientInputSchema = clientSchema.pick({
  name: true,
  phone: true,
  notes: true,
});

export const clientListQuerySchema = z.object({ ...paginationFields });

import { z } from "zod";

import { paginationFields } from "@/shared/lib/pagination";
import { MAX_INSTALLMENTS, type ScheduleTerms } from "./domain/schedule";

export const contractIdSchema = z.uuid({ error: "معرّف العقد غير صحيح" });

export const contractSchema = z.object({
  id: contractIdSchema,
  reservationId: z.uuid({ error: "معرّف الحجز غير صحيح" }),
  finalPrice: z
    .number({ error: "أدخل السعر النهائي" })
    .int("السعر النهائي يجب أن يكون عدداً صحيحاً بالهللات")
    .min(1, "السعر النهائي يجب أن يكون موجباً")
    .max(100_000_000_000, "السعر النهائي يجب ألا يتجاوز مليار ريال"),
  downPayment: z
    .number({ error: "أدخل الدفعة المقدمة" })
    .int("الدفعة المقدمة يجب أن تكون عدداً صحيحاً بالهللات")
    .min(0, "الدفعة المقدمة لا يمكن أن تكون سالبة")
    .max(100_000_000_000, "الدفعة المقدمة يجب ألا تتجاوز مليار ريال"),
  installmentCount: z
    .number({ error: "أدخل عدد الأقساط" })
    .int("عدد الأقساط يجب أن يكون عدداً صحيحاً")
    .min(1, "عدد الأقساط يجب أن يكون ١ على الأقل")
    .max(MAX_INSTALLMENTS, "عدد الأقساط يجب ألا يتجاوز ١٢٠"),
});

export function contractTermsRefine(terms: ScheduleTerms, ctx: z.RefinementCtx): void {
  if (terms.downPayment >= terms.finalPrice) {
    ctx.addIssue({
      code: "custom",
      path: ["downPayment"],
      message: "الدفعة المقدمة يجب أن تكون أقل من السعر النهائي",
    });
  }
  if (terms.finalPrice - terms.downPayment < terms.installmentCount * 100) {
    ctx.addIssue({
      code: "custom",
      path: ["installmentCount"],
      message: "يجب ألا يقل مبلغ كل قسط عن ريال واحد",
    });
  }
}

export const contractTermsInputSchema = contractSchema
  .pick({
    finalPrice: true,
    downPayment: true,
    installmentCount: true,
  })
  .superRefine(contractTermsRefine);

export const createContractInputSchema = contractSchema
  .pick({
    reservationId: true,
    finalPrice: true,
    downPayment: true,
    installmentCount: true,
  })
  .superRefine(contractTermsRefine);

export const contractListQuerySchema = z.object({ ...paginationFields });
export const contractOptionsQuerySchema = contractSchema.pick({ reservationId: true });

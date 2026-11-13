import { z } from "zod";

import { digits, paginationFields } from "@/shared/lib/pagination";

export const UNIT_NUMBER_TAKEN = "رقم الوحدة مستخدم في هذا المشروع";

export const unitIdSchema = z.uuid({ error: "معرّف الوحدة غير صحيح" });

export const unitSchema = z.object({
  id: unitIdSchema,
  projectName: z
    .string({ error: "أدخل اسم المشروع" })
    .trim()
    .min(1, "اسم المشروع مطلوب")
    .max(100, "اسم المشروع يجب ألا يتجاوز ١٠٠ حرف"),
  number: z
    .string({ error: "أدخل رقم الوحدة" })
    .trim()
    .min(1, "رقم الوحدة مطلوب")
    .max(20, "رقم الوحدة يجب ألا يتجاوز ٢٠ حرفاً"),
  type: z.enum(["APARTMENT", "VILLA", "TOWNHOUSE", "DUPLEX"], { error: "اختر نوع الوحدة" }),
  area: z
    .number({ error: "أدخل مساحة صحيحة" })
    .int("المساحة يجب أن تكون عدداً صحيحاً")
    .min(1, "المساحة يجب أن تكون ١ على الأقل")
    .max(100_000, "المساحة يجب ألا تتجاوز ١٠٠٬٠٠٠"),
  rooms: z
    .number({ error: "أدخل عدد الغرف" })
    .int("عدد الغرف يجب أن يكون عدداً صحيحاً")
    .min(0, "عدد الغرف لا يمكن أن يكون سالباً")
    .max(50, "عدد الغرف يجب ألا يتجاوز ٥٠"),
  price: z
    .number({ error: "أدخل سعراً صحيحاً" })
    .int("السعر يجب أن يكون عدداً صحيحاً بالهللات")
    .min(1, "السعر يجب أن يكون موجباً")
    .max(100_000_000_000, "السعر يجب ألا يتجاوز مليار ريال"),
  status: z.enum(["AVAILABLE", "RESERVED", "SOLD"], { error: "حالة الوحدة غير صحيحة" }),
});

export const unitInputSchema = unitSchema.pick({
  projectName: true,
  number: true,
  type: true,
  area: true,
  rooms: true,
  price: true,
});

const priceFilter = digits
  .pipe(z.number().max(100_000_000_000, "السعر يجب ألا يتجاوز مليار ريال"))
  .optional();

export const unitListQuerySchema = z
  .object({
    status: unitSchema.shape.status.optional(),
    minPrice: priceFilter,
    maxPrice: priceFilter,
    sort: z.enum(["price", "area"], { error: "اختر ترتيباً صحيحاً" }).optional(),
    order: z.enum(["asc", "desc"], { error: "اتجاه الترتيب غير صحيح" }).default("asc"),
    ...paginationFields,
  })
  .refine(
    ({ minPrice, maxPrice }) =>
      minPrice === undefined || maxPrice === undefined || minPrice <= maxPrice,
    { path: ["minPrice"], message: "الحد الأدنى للسعر يجب ألا يتجاوز الحد الأعلى" },
  );

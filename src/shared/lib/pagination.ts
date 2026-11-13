import { z } from "zod";

export const digits = z
  .string({ error: "أدخل أرقاماً صحيحة" })
  .regex(/^\d+$/, "أدخل أرقاماً صحيحة")
  .transform(Number)
  .pipe(z.number().int("أدخل عدداً صحيحاً ضمن النطاق المسموح"));

export const paginationFields = {
  page: digits
    .pipe(
      z
        .number()
        .min(1, "رقم الصفحة يجب أن يكون ١ على الأقل")
        .max(100_000, "رقم الصفحة يجب ألا يتجاوز ١٠٠٬٠٠٠"),
    )
    .default(1),
  pageSize: digits
    .pipe(
      z
        .number()
        .min(1, "حجم الصفحة يجب أن يكون ١ على الأقل")
        .max(50, "حجم الصفحة يجب ألا يتجاوز ٥٠"),
    )
    .default(20),
};

export type Page<T> = { items: T[]; total: number; page: number; pageSize: number };

export function toSkip(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}

import { z } from "zod";

export const authFields = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("أدخل بريدًا إلكترونيًا صحيحًا")
    .max(254, "أدخل بريدًا إلكترونيًا صحيحًا"),
  password: z.string().min(1, "أدخل كلمة المرور").max(128, "كلمة المرور طويلة جدًا"),
});

export const loginSchema = authFields.pick({ email: true, password: true });

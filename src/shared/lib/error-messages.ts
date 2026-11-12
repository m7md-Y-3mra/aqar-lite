import type { ErrorCode } from "@/server/http/error-codes";

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_ERROR: "البيانات المدخلة غير صحيحة",
  UNAUTHORIZED: "يجب تسجيل الدخول أولاً",
  INVALID_CREDENTIALS: "البريد الإلكتروني أو كلمة المرور غير صحيحة",
  FORBIDDEN: "ليست لديك صلاحية لهذا الإجراء",
  INVALID_ORIGIN: "تم رفض الطلب",
  NOT_FOUND: "العنصر غير موجود",
  INTERNAL_ERROR: "حدث خطأ غير متوقع، حاول مرة أخرى",
};

import type { ErrorCode } from "@/server/http/error-codes";

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_ERROR: "البيانات المدخلة غير صحيحة",
  UNAUTHORIZED: "يجب تسجيل الدخول أولاً",
  INVALID_CREDENTIALS: "البريد الإلكتروني أو كلمة المرور غير صحيحة",
  FORBIDDEN: "ليست لديك صلاحية لهذا الإجراء",
  INVALID_ORIGIN: "تم رفض الطلب",
  NOT_FOUND: "العنصر غير موجود",
  UNIT_PRICE_LOCKED: "لا يمكن تغيير سعر وحدة محجوزة أو مباعة",
  UNIT_CHANGED: "تم تعديل هذه الوحدة للتو، حدّث الصفحة وحاول مرة أخرى",
  UNIT_NOT_AVAILABLE: "هذه الوحدة لم تعد متاحة، فقد حُجزت للتو. اختر وحدة أخرى.",
  CONTRACT_EXISTS: "يوجد عقد لهذا الحجز بالفعل",
  CONTRACT_ALREADY_APPROVED: "تم اعتماد هذا العقد ولا يمكن تعديله",
  CONTRACT_CHANGED: "تم تعديل العقد بعد أن فتحته، راجع القيم الجديدة ثم اعتمد مرة أخرى",
  RESERVATION_EXPIRED: "انتهت مدة الحجز، لا يمكن إنشاء العقد أو تعديله أو اعتماده",
  INTERNAL_ERROR: "حدث خطأ غير متوقع، حاول مرة أخرى",
};

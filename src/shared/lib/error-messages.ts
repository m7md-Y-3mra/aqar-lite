import type { ErrorCode } from "@/server/http/error-codes";
import { formatRiyals } from "@/shared/lib/money";

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
  CONTRACT_NOT_APPROVED: "لا يمكن تسجيل دفعة على عقد غير معتمد",
  PAYMENT_EXCEEDS_REMAINING: "المبلغ أكبر من المتبقي على العقد",
  IDEMPOTENCY_KEY_REUSED: "سُجّلت هذه الدفعة من قبل بمبلغ مختلف. حدّث الصفحة وحاول مرة أخرى.",
  INTERNAL_ERROR: "حدث خطأ غير متوقع، حاول مرة أخرى",
};

export function paymentExceedsRemainingMessage(remainingHalalas: number): string {
  return `المبلغ أكبر من المتبقي على العقد. المتبقي: ${formatRiyals(remainingHalalas)} ريال`;
}

export function idempotencyKeyReusedMessage(savedHalalas: number): string {
  return `سُجّلت هذه الدفعة من قبل بمبلغ ${formatRiyals(savedHalalas)} ريال. حدّث الصفحة وحاول مرة أخرى.`;
}

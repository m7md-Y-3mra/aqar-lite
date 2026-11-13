import { TZDate } from "@date-fns/tz";
import { differenceInMinutes, format } from "date-fns";

export function formatRiyadhDateTime(iso: string): string {
  return format(new TZDate(iso, "Asia/Riyadh"), "yyyy/MM/dd HH:mm");
}

export function formatTimeLeft(expiresAt: string, asOf: string): string {
  const minutes = differenceInMinutes(new Date(expiresAt), new Date(asOf));
  if (minutes < 1) return "أقل من دقيقة";

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return hours > 0 ? `${hours} ساعة و ${remainingMinutes} دقيقة` : `${minutes} دقيقة`;
}

export function toRiyadhDate(instant: Date): string {
  return format(new TZDate(instant, "Asia/Riyadh"), "yyyy-MM-dd");
}

// A calendar date is already a Riyadh date; parsing it as an instant could shift it by a day.
export function formatRiyadhDate(ymd: string): string {
  return ymd.replaceAll("-", "/");
}

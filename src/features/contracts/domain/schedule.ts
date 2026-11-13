import { TZDate } from "@date-fns/tz";
import { addMonths, format } from "date-fns";

export const MAX_INSTALLMENTS = 120;

export type ScheduleTerms = {
  finalPrice: number;
  downPayment: number;
  installmentCount: number;
};

export type ScheduleLine = { seq: number; dueDate: string; amount: number };

export function buildSchedule(terms: ScheduleTerms, startDate: string): ScheduleLine[] {
  const { finalPrice, downPayment, installmentCount } = terms;
  const parts = startDate.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  const start = new TZDate(year, month - 1, day, "Asia/Riyadh");
  const rest = finalPrice - downPayment;
  const base = Math.floor(rest / (installmentCount * 100)) * 100;
  const lines: ScheduleLine[] =
    downPayment > 0 ? [{ seq: 0, dueDate: startDate, amount: downPayment }] : [];

  for (let seq = 1; seq <= installmentCount; seq++) {
    lines.push({
      seq,
      dueDate: format(addMonths(start, seq), "yyyy-MM-dd"),
      amount: seq === installmentCount ? rest - base * (installmentCount - 1) : base,
    });
  }
  return lines;
}

export function scheduleTotal(lines: readonly ScheduleLine[]): number {
  return lines.reduce((total, line) => total + line.amount, 0);
}

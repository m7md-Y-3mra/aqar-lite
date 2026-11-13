import { describe, expect, it } from "vitest";

import {
  type AllocationLine,
  allocatePayment,
  openAmount,
} from "@/features/payments/domain/allocation";

// Down payment 50,000 riyals, then three monthly lines of 10,000 riyals (halalas).
function schedule(paid: number[] = []): AllocationLine[] {
  return [5_000_000, 1_000_000, 1_000_000, 1_000_000].map((amount, seq) => ({
    id: `line-${seq}`,
    seq,
    amount,
    paidAmount: paid[seq] ?? 0,
  }));
}

function applied(lines: AllocationLine[], amount: number) {
  return allocatePayment(lines, amount).map(({ seq, applied }) => [seq, applied]);
}

describe("allocatePayment", () => {
  it("puts a partial payment on the down payment only", () => {
    expect(applied(schedule(), 2_000_000)).toEqual([[0, 2_000_000]]);
  });

  it("fills the down payment, then the next line, then part of the one after", () => {
    expect(applied(schedule([2_000_000]), 4_500_000)).toEqual([
      [0, 3_000_000],
      [1, 1_000_000],
      [2, 500_000],
    ]);
  });

  it("pays every line exactly with a final payment equal to the open amount", () => {
    const lines = schedule([5_000_000, 400_000]);
    expect(openAmount(lines)).toBe(2_600_000);
    expect(applied(lines, 2_600_000)).toEqual([
      [1, 600_000],
      [2, 1_000_000],
      [3, 1_000_000],
    ]);
  });

  it("tops up a line that is already partly paid before moving on", () => {
    expect(applied(schedule([5_000_000, 999_999]), 2)).toEqual([
      [1, 1],
      [2, 1],
    ]);
  });

  it("starts at line 1 when there is no down payment", () => {
    const lines = schedule().slice(1);
    expect(applied(lines, 1_500_000)).toEqual([
      [1, 1_000_000],
      [2, 500_000],
    ]);
  });

  it("orders lines by seq, not by input order", () => {
    expect(applied(schedule().reverse(), 5_000_001)).toEqual([
      [0, 5_000_000],
      [1, 1],
    ]);
  });

  it("carries halalas into the last line", () => {
    const lines: AllocationLine[] = [
      { id: "a", seq: 1, amount: 3_333_300, paidAmount: 0 },
      { id: "b", seq: 2, amount: 3_333_367, paidAmount: 0 },
    ];
    expect(applied(lines, 6_666_667)).toEqual([
      [1, 3_333_300],
      [2, 3_333_367],
    ]);
  });

  it("refuses an amount above the open amount", () => {
    const lines = schedule([5_000_000, 1_000_000, 1_000_000, 1_000_000 - 1]);
    expect(() => allocatePayment(lines, 2)).toThrow(RangeError);
  });

  it.each([0, -1, 1.5])("refuses a non-positive or fractional amount %j", (amount) => {
    expect(() => allocatePayment(schedule(), amount)).toThrow(RangeError);
  });

  it("always applies exactly the payment and never overfills a line", () => {
    // Small deterministic generator, so a failure can be replayed.
    let state = 42;
    const next = (max: number) => {
      state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
      return state % max;
    };

    for (let round = 0; round < 500; round += 1) {
      const lines: AllocationLine[] = Array.from({ length: 1 + next(12) }, (_, seq) => {
        const amount = 1 + next(5_000_000);
        return { id: `l${seq}`, seq, amount, paidAmount: next(amount + 1) };
      });
      const open = openAmount(lines);
      if (open === 0) continue;
      const amount = 1 + next(open);

      const result = allocatePayment(lines, amount);

      expect(result.reduce((sum, item) => sum + item.applied, 0)).toBe(amount);
      for (const item of result) {
        const line = lines.find((l) => l.id === item.installmentId)!;
        expect(item.applied).toBeGreaterThan(0);
        expect(line.paidAmount + item.applied).toBeLessThanOrEqual(line.amount);
      }
    }
  });
});

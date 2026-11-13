import { describe, expect, it } from "vitest";

import { buildSchedule, scheduleTotal } from "@/features/contracts/domain/schedule";

const terms = { finalPrice: 10_000_000, downPayment: 0, installmentCount: 3 };
const dates = (start: string, count = 3) =>
  buildSchedule({ ...terms, installmentCount: count }, start).map((line) => line.dueDate);

describe("schedule", () => {
  it("100,000 over 3 → 33,333 / 33,333 / 33,334", () => {
    expect(buildSchedule(terms, "2027-01-31").map((line) => line.amount)).toEqual([
      3_333_300, 3_333_300, 3_333_400,
    ]);
  });
  it("31 January start → 28 Feb, 31 Mar, 30 Apr", () => {
    expect(dates("2027-01-31")).toEqual(["2027-02-28", "2027-03-31", "2027-04-30"]);
  });
  it("30 January start → 28 Feb, 30 Mar", () => {
    expect(dates("2027-01-30", 2)).toEqual(["2027-02-28", "2027-03-30"]);
  });
  it("31 January 2028 → 29 February 2028", () => {
    expect(dates("2028-01-31", 1)).toEqual(["2028-02-29"]);
  });
  it("29 February 2028 + 12 → 28 February 2029", () => {
    expect(dates("2028-02-29", 12)[11]).toBe("2029-02-28");
  });
  it("each date counts from the start, not the previous line", () => {
    expect(dates("2027-08-31", 4)).toEqual([
      "2027-09-30",
      "2027-10-31",
      "2027-11-30",
      "2027-12-31",
    ]);
  });
  it("down payment is line 0 due on the start date", () => {
    expect(buildSchedule({ ...terms, downPayment: 1_000_000 }, "2027-01-31")[0]).toEqual({
      seq: 0,
      dueDate: "2027-01-31",
      amount: 1_000_000,
    });
  });
  it("down payment 0 → no seq 0, first line one month after start", () => {
    const lines = buildSchedule(terms, "2027-01-31");
    expect(lines.map((line) => line.seq)).toEqual([1, 2, 3]);
    expect(lines[0]?.dueDate).toBe("2027-02-28");
  });
  it("remainder with halalas goes to the last line", () => {
    expect(
      buildSchedule({ ...terms, finalPrice: 10_000_007 }, "2027-01-31").map((line) => line.amount),
    ).toEqual([3_333_300, 3_333_300, 3_333_407]);
  });
  it("every line is at least 100 halalas for valid terms", () => {
    for (let installmentCount = 1; installmentCount <= 120; installmentCount++) {
      const lines = buildSchedule(
        { finalPrice: installmentCount * 100 + 100, downPayment: 100, installmentCount },
        "2027-01-31",
      );
      expect(lines.every((line) => line.amount >= 100)).toBe(true);
    }
  });
  it("sum equals finalPrice for every combination", () => {
    for (const finalPrice of [100, 301, 12_000, 12_055, 10_000_000, 100_000_000_000]) {
      for (const downPayment of [0, 1, 100, 105, 1_000]) {
        for (let installmentCount = 1; installmentCount <= 120; installmentCount++) {
          if (finalPrice - downPayment < installmentCount * 100) continue;
          const lines = buildSchedule({ finalPrice, downPayment, installmentCount }, "2027-01-31");
          expect(scheduleTotal(lines)).toBe(finalPrice);
        }
      }
    }
    // About 26 s alone; the global 30 s limit fails it when the machine is busy.
  }, 120_000);
});

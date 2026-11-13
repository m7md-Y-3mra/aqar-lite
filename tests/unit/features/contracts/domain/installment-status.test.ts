import { describe, expect, it } from "vitest";

import {
  contractRemaining,
  installmentStatus,
} from "@/features/contracts/domain/installment-status";

const today = "2027-01-31";
describe("installment status", () => {
  it("paid when paidAmount equals amount, even past due", () => {
    expect(installmentStatus({ amount: 100, paidAmount: 100, dueDate: "2027-01-01" }, today)).toBe(
      "PAID",
    );
  });
  it("overdue when unpaid and due before today", () => {
    expect(installmentStatus({ amount: 100, paidAmount: 0, dueDate: "2027-01-30" }, today)).toBe(
      "OVERDUE",
    );
  });
  it("overdue wins over partial", () => {
    expect(installmentStatus({ amount: 100, paidAmount: 50, dueDate: "2027-01-30" }, today)).toBe(
      "OVERDUE",
    );
  });
  it("partial when part paid and due today or later", () => {
    for (const dueDate of [today, "2027-02-01"]) {
      expect(installmentStatus({ amount: 100, paidAmount: 50, dueDate }, today)).toBe("PARTIAL");
    }
  });
  it("unpaid when nothing paid and due today (not overdue)", () => {
    expect(installmentStatus({ amount: 100, paidAmount: 0, dueDate: today }, today)).toBe("UNPAID");
  });
  it("down payment due on the approval date is overdue the next day", () => {
    expect(installmentStatus({ amount: 100, paidAmount: 0, dueDate: today }, "2027-02-01")).toBe(
      "OVERDUE",
    );
  });
  it("contractRemaining subtracts all paid amounts", () => {
    expect(contractRemaining(1_000, [{ paidAmount: 100 }, { paidAmount: 50 }])).toBe(850);
    expect(contractRemaining(1_000, [])).toBe(1_000);
  });
});

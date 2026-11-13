import { describe, expect, it } from "vitest";

import {
  contractListQuerySchema,
  contractTermsInputSchema,
  createContractInputSchema,
} from "@/features/contracts/contracts.schemas";

const terms = { finalPrice: 10_000_000, downPayment: 0, installmentCount: 3 };

describe("contract schemas", () => {
  it("create input strips approvedAt, companyId, status, schedule, salesRepId", () => {
    const input = { ...terms, reservationId: "b2dd5730-314c-4d5a-a7ce-c53b70f0fc36" };
    expect(
      createContractInputSchema.parse({
        ...input,
        approvedAt: "2027-01-31",
        companyId: "tenant",
        status: "APPROVED",
        schedule: [],
        salesRepId: "rep",
      }),
    ).toEqual(input);
  });
  it("downPayment equal to finalPrice → error on downPayment", () => {
    const result = contractTermsInputSchema.safeParse({ ...terms, downPayment: terms.finalPrice });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.flatten().fieldErrors.downPayment).toBeDefined();
  });
  it("negative downPayment → error", () => {
    expect(contractTermsInputSchema.safeParse({ ...terms, downPayment: -1 }).success).toBe(false);
  });
  it("installmentCount 0, 121 and 1.5 → error", () => {
    for (const installmentCount of [0, 121, 1.5]) {
      expect(contractTermsInputSchema.safeParse({ ...terms, installmentCount }).success).toBe(
        false,
      );
    }
  });
  it("1 and 120 accepted", () => {
    for (const installmentCount of [1, 120]) {
      expect(contractTermsInputSchema.safeParse({ ...terms, installmentCount }).success).toBe(true);
    }
  });
  it("2 riyals over 3 installments → error on installmentCount", () => {
    const result = contractTermsInputSchema.safeParse({ ...terms, finalPrice: 200 });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.flatten().fieldErrors.installmentCount).toBeDefined();
  });
  it("3 riyals over 3 accepted", () => {
    expect(contractTermsInputSchema.safeParse({ ...terms, finalPrice: 300 }).success).toBe(true);
  });
  it("pageSize 51 → error", () => {
    expect(contractListQuerySchema.safeParse({ pageSize: "51" }).success).toBe(false);
  });
  it("defaults 1 / 20", () => {
    expect(contractListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });
  it("unknown status key is stripped", () => {
    expect(contractListQuerySchema.parse({ status: "DRAFT" })).toEqual({ page: 1, pageSize: 20 });
  });
});

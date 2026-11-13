import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  MAX_IDEMPOTENCY_KEY_LENGTH,
  idempotencyKeySchema,
  paymentContractIdSchema,
  recordPaymentInputSchema,
} from "@/features/payments/payments.schemas";

describe("recordPaymentInputSchema", () => {
  it.each([
    [0, "المبلغ يجب أن يكون أكبر من صفر"],
    [-100, "المبلغ يجب أن يكون أكبر من صفر"],
    [10.5, "المبلغ يجب أن يكون عدداً صحيحاً بالهللات"],
    [100_000_000_001, "المبلغ يجب ألا يتجاوز مليار ريال"],
    ["500", "أدخل مبلغاً صحيحاً"],
  ])("rejects amount %j", (amount, message) => {
    const parsed = recordPaymentInputSchema.safeParse({ amount });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(z.flattenError(parsed.error).fieldErrors).toEqual({ amount: [message] });
    }
  });

  it.each([1, 1_234_567, 100_000_000_000])("accepts amount %j halalas", (amount) => {
    expect(recordPaymentInputSchema.parse({ amount })).toEqual({ amount });
  });

  it("strips contractId, companyId, userId, createdAt and idempotencyKey", () => {
    expect(
      recordPaymentInputSchema.parse({
        amount: 500,
        contractId: "f8ec2ac8-4b5c-456d-b8de-a7b7c5068324",
        companyId: "foreign-company",
        userId: "foreign-user",
        createdAt: "2020-01-01T00:00:00.000Z",
        idempotencyKey: "body-key",
      }),
    ).toEqual({ amount: 500 });
  });
});

describe("idempotencyKeySchema", () => {
  it.each([undefined, "", "   ", "k".repeat(MAX_IDEMPOTENCY_KEY_LENGTH + 1)])(
    "rejects %j",
    (key) => {
      expect(idempotencyKeySchema.safeParse(key).success).toBe(false);
    },
  );

  it("accepts a UUID and a key of the maximum length", () => {
    const uuid = "6c1f7d2e-3b4a-4c5d-8e9f-0a1b2c3d4e5f";
    expect(idempotencyKeySchema.parse(uuid)).toBe(uuid);
    const longest = "k".repeat(MAX_IDEMPOTENCY_KEY_LENGTH);
    expect(idempotencyKeySchema.parse(longest)).toBe(longest);
  });
});

describe("paymentContractIdSchema", () => {
  it("rejects a non-UUID contract id", () => {
    expect(paymentContractIdSchema.safeParse("1 OR 1=1").success).toBe(false);
  });
});

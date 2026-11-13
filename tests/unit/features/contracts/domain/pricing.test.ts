import { describe, expect, it } from "vitest";

import { minFinalPrice } from "@/features/contracts/domain/pricing";

describe("pricing", () => {
  it("475,000 for 500,000", () => {
    expect(minFinalPrice(50_000_000)).toBe(47_500_000);
  });
  it("rounds 95% up to the next halala (unit price 1 → 1)", () => {
    expect(minFinalPrice(1)).toBe(1);
  });
  it("matches a BigInt ceiling for 10,000 sampled prices up to 1e11", () => {
    let seed = 17;
    for (let i = 0; i < 10_000; i++) {
      seed = (seed * 48_271) % 2_147_483_647;
      const price = 1 + Math.floor((seed / 2_147_483_647) * 99_999_999_999);
      expect(minFinalPrice(price)).toBe(Number((BigInt(price) * 95n + 99n) / 100n));
    }
    expect(minFinalPrice(100_000_000_000)).toBe(95_000_000_000);
  });
});

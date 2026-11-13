import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  reservationListQuerySchema,
  reserveInputSchema,
  reserveOptionsQuerySchema,
} from "@/features/reservations/reservations.schemas";

const validInput = {
  unitId: "f8ec2ac8-4b5c-456d-b8de-a7b7c5068324",
  clientId: "eb2298dc-7188-422f-9813-a3d9491687c6",
};

describe("reserveInputSchema", () => {
  it.each([{}, { unitId: "not-a-uuid", clientId: "not-a-uuid" }])(
    "rejects missing / non-UUID unitId and clientId: %j",
    (input) => {
      const parsed = reserveInputSchema.safeParse(input);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(z.flattenError(parsed.error).fieldErrors).toEqual({
          unitId: ["اختر وحدة صحيحة"],
          clientId: ["اختر عميلاً"],
        });
      }
    },
  );

  it("strips expiresAt, salesRepId, companyId, status", () => {
    expect(
      reserveInputSchema.parse({
        ...validInput,
        expiresAt: "2030-01-01T00:00:00.000Z",
        salesRepId: "foreign-rep",
        companyId: "foreign-company",
        status: "SOLD",
      }),
    ).toEqual(validInput);
  });
});

describe("reservationListQuerySchema", () => {
  it("pageSize 51 → error", () => {
    const parsed = reservationListQuerySchema.safeParse({ pageSize: "51" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(z.flattenError(parsed.error).fieldErrors.pageSize).toBeDefined();
    }
  });

  it("defaults 1 / 20", () => {
    expect(reservationListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });
});

describe("reserveOptionsQuerySchema", () => {
  it("options query rejects a non-UUID unitId", () => {
    const parsed = reserveOptionsQuerySchema.safeParse({ unitId: "not-a-uuid" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(z.flattenError(parsed.error).fieldErrors.unitId).toEqual(["اختر وحدة صحيحة"]);
    }
  });
});

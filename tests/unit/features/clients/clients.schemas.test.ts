import { describe, expect, it } from "vitest";

import {
  clientIdSchema,
  clientInputSchema,
  clientListQuerySchema,
} from "@/features/clients/clients.schemas";

const validInput = { name: "عميل اختبار", phone: "0500000000", notes: null };

describe("clientInputSchema", () => {
  it("accepts +966 50-000-0000", () => {
    expect(clientInputSchema.parse({ ...validInput, phone: "+966 50-000-0000" }).phone).toBe(
      "+966 50-000-0000",
    );
  });

  it("accepts 0500000000", () => {
    expect(clientInputSchema.parse(validInput)).toEqual(validInput);
  });

  it("rejects letters", () => {
    expect(clientInputSchema.safeParse({ ...validInput, phone: "050abc0000" }).success).toBe(false);
  });

  it("rejects 6 and 21 chars", () => {
    for (const phone of ["1".repeat(6), "+" + "1".repeat(20)]) {
      expect(clientInputSchema.safeParse({ ...validInput, phone }).success).toBe(false);
    }
  });

  it("notes over 2000 rejected", () => {
    expect(clientInputSchema.safeParse({ ...validInput, notes: "س".repeat(2001) }).success).toBe(
      false,
    );
  });

  it("empty notes → null", () => {
    for (const notes of ["", "  \n "]) {
      expect(clientInputSchema.parse({ ...validInput, notes }).notes).toBeNull();
    }
  });

  it("keeps line breaks in notes", () => {
    const notes = "<b>مهم</b>\n<script>alert(1)</script>";
    expect(clientInputSchema.parse({ ...validInput, notes }).notes).toBe(notes);
  });

  it("input strips salesRepId and companyId", () => {
    expect(
      clientInputSchema.parse({
        ...validInput,
        salesRepId: "foreign-rep",
        companyId: "foreign-company",
        status: "SOLD",
        id: "hand-sent-id",
      }),
    ).toEqual(validInput);
  });

  it("accepts omitted and null notes as null", () => {
    expect(clientInputSchema.parse({ name: validInput.name, phone: validInput.phone })).toEqual(
      validInput,
    );
    expect(clientInputSchema.parse(validInput)).toEqual(validInput);
  });

  it("trims name, phone and notes", () => {
    expect(
      clientInputSchema.parse({ name: "  عميل اختبار  ", phone: " 0500000000 ", notes: " مهم " }),
    ).toEqual({ ...validInput, notes: "مهم" });
  });

  it.each([
    ["empty name", { name: "  " }],
    ["name of 101 chars", { name: "س".repeat(101) }],
    ["empty phone", { phone: "  " }],
    ["misplaced plus", { phone: "050+000000" }],
  ])("rejects %s", (_name, patch) => {
    expect(clientInputSchema.safeParse({ ...validInput, ...patch }).success).toBe(false);
  });

  it("accepts inclusive field limits", () => {
    for (const phone of ["1".repeat(7), "+" + "1".repeat(19)]) {
      expect(
        clientInputSchema.safeParse({
          name: "س".repeat(100),
          phone,
          notes: "س".repeat(2000),
        }).success,
      ).toBe(true);
    }
  });
});

describe("clientListQuerySchema", () => {
  it("rejects pageSize 51", () => {
    expect(clientListQuerySchema.safeParse({ pageSize: "51" }).success).toBe(false);
  });

  it("rejects page 0", () => {
    expect(clientListQuerySchema.safeParse({ page: "0" }).success).toBe(false);
  });

  it("applies defaults and strips unknown parameters", () => {
    expect(clientListQuerySchema.parse({ companyId: "foreign-company" })).toEqual({
      page: 1,
      pageSize: 20,
    });
  });
});

describe("clientIdSchema", () => {
  it("accepts UUIDs only", () => {
    expect(clientIdSchema.safeParse("f8ec2ac8-4b5c-456d-b8de-a7b7c5068324").success).toBe(true);
    expect(clientIdSchema.safeParse("not-a-uuid").success).toBe(false);
  });
});

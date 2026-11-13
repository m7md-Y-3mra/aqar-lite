import { describe, expect, it } from "vitest";

import { toAuditEvent, type AuditLogRow } from "@/features/audit-log/domain/audit-event";
import type { AuditAction } from "@/features/audit-log/audit-log.types";

const entityId = "16dfd96c-d872-4f06-a98d-e97dbe21e285";
const contractId = "92cb28f0-69df-4ac4-b4de-a732e16c6928";
const createdAt = new Date("2026-11-13T09:15:02.123Z");
const loginMeta = { email: "sales@example.test", reason: "invalid_credentials" };
const priceMeta = { oldPrice: 10_000_001, newPrice: 12_000_003 };
const approvalMeta = {
  unitPrice: 10_000_001,
  finalPrice: 9_500_001,
  downPayment: 500_001,
  installmentCount: 10,
  startDate: "2026-11-13",
};
const paymentMeta = {
  contractId,
  amount: 500_001,
  allocation: [
    { seq: 0, applied: 200_001 },
    { seq: 1, applied: 300_000 },
  ],
  remainingAfter: 9_000_001,
};

function row(
  action: AuditAction,
  meta: unknown,
  overrides: Partial<AuditLogRow> = {},
): AuditLogRow {
  return {
    id: "event-id",
    action,
    entityId,
    meta,
    createdAt,
    actorName: "مدير الشركة",
    ...overrides,
  };
}

describe("toAuditEvent", () => {
  it("returns the typed email and reason for failed login, never the targeted actor's name", () => {
    expect(toAuditEvent(row("LOGIN_FAILED", loginMeta))).toEqual({
      id: "event-id",
      action: "LOGIN_FAILED",
      createdAt: "2026-11-13T09:15:02.123Z",
      actorName: null,
      details: loginMeta,
    });
  });

  it("accepts the locked login reason", () => {
    expect(toAuditEvent(row("LOGIN_FAILED", { ...loginMeta, reason: "locked" })).details).toEqual({
      ...loginMeta,
      reason: "locked",
    });
  });

  it("takes the unit id from entityId and preserves integer halalas for price changes", () => {
    expect(toAuditEvent(row("PRICE_CHANGED", priceMeta))).toEqual({
      id: "event-id",
      action: "PRICE_CHANGED",
      createdAt: createdAt.toISOString(),
      actorName: "مدير الشركة",
      details: { unitId: entityId, ...priceMeta },
    });
  });

  it("takes the contract id from entityId and returns every approval term", () => {
    expect(toAuditEvent(row("CONTRACT_APPROVED", approvalMeta))).toEqual({
      id: "event-id",
      action: "CONTRACT_APPROVED",
      createdAt: createdAt.toISOString(),
      actorName: "مدير الشركة",
      details: { contractId: entityId, ...approvalMeta },
    });
  });

  it("takes payment details and the contract id from meta, not the payment entityId", () => {
    expect(toAuditEvent(row("PAYMENT_RECORDED", paymentMeta))).toEqual({
      id: "event-id",
      action: "PAYMENT_RECORDED",
      createdAt: createdAt.toISOString(),
      actorName: "مدير الشركة",
      details: paymentMeta,
    });
  });

  it.each([
    { action: "LOGIN_FAILED", meta: loginMeta, details: loginMeta },
    { action: "PRICE_CHANGED", meta: priceMeta, details: { unitId: entityId, ...priceMeta } },
    {
      action: "CONTRACT_APPROVED",
      meta: approvalMeta,
      details: { contractId: entityId, ...approvalMeta },
    },
    { action: "PAYMENT_RECORDED", meta: paymentMeta, details: paymentMeta },
  ] as const)("drops extra meta keys for $action", ({ action, meta, details }) => {
    const event = toAuditEvent(row(action, { ...meta, unitId: "untrusted", password: "secret" }));
    expect(event.details).toEqual(details);
    expect(event).not.toHaveProperty("meta");
    expect(event).not.toHaveProperty("entityId");
    expect(event).not.toHaveProperty("userId");
    expect(event).not.toHaveProperty("companyId");
  });

  it("drops extra keys from nested payment allocations", () => {
    const event = toAuditEvent(
      row("PAYMENT_RECORDED", {
        ...paymentMeta,
        allocation: [{ seq: 1, applied: 500_001, privateValue: "secret" }],
      }),
    );
    expect(event.details).toEqual({
      ...paymentMeta,
      allocation: [{ seq: 1, applied: 500_001 }],
    });
  });

  it.each([
    { action: "LOGIN_FAILED", meta: { reason: "locked" } },
    { action: "LOGIN_FAILED", meta: { ...loginMeta, email: 123 } },
    { action: "LOGIN_FAILED", meta: { ...loginMeta, reason: "unknown" } },
    { action: "PRICE_CHANGED", meta: { oldPrice: 1 } },
    { action: "PRICE_CHANGED", meta: { ...priceMeta, newPrice: "12000003" } },
    { action: "PRICE_CHANGED", meta: { ...priceMeta, oldPrice: 1.5 } },
    { action: "PRICE_CHANGED", meta: { ...priceMeta, newPrice: -1 } },
    { action: "CONTRACT_APPROVED", meta: { finalPrice: 1 } },
    { action: "CONTRACT_APPROVED", meta: { ...approvalMeta, downPayment: "0" } },
    { action: "CONTRACT_APPROVED", meta: { ...approvalMeta, installmentCount: 0 } },
    { action: "CONTRACT_APPROVED", meta: { ...approvalMeta, startDate: "13/11/2026" } },
    { action: "PAYMENT_RECORDED", meta: { amount: 1 } },
    { action: "PAYMENT_RECORDED", meta: { ...paymentMeta, amount: "500001" } },
    { action: "PAYMENT_RECORDED", meta: { ...paymentMeta, amount: 0 } },
    { action: "PAYMENT_RECORDED", meta: { ...paymentMeta, contractId: "not-a-uuid" } },
    { action: "PAYMENT_RECORDED", meta: { ...paymentMeta, allocation: [{ seq: 1, applied: 0 }] } },
  ] as const)("returns null details for malformed $action meta: $meta", ({ action, meta }) => {
    expect(toAuditEvent(row(action, meta)).details).toBeNull();
  });

  it.each(["LOGIN_FAILED", "PRICE_CHANGED", "CONTRACT_APPROVED", "PAYMENT_RECORDED"] as const)(
    "returns null details for null %s meta",
    (action) => {
      expect(toAuditEvent(row(action, null)).details).toBeNull();
    },
  );

  it.each([
    { action: "PRICE_CHANGED", meta: priceMeta },
    { action: "CONTRACT_APPROVED", meta: approvalMeta },
  ] as const)("requires entityId for $action", ({ action, meta }) => {
    expect(toAuditEvent(row(action, meta, { entityId: null })).details).toBeNull();
  });

  it("accepts a null entityId for payment because its contract id is in parsed meta", () => {
    expect(toAuditEvent(row("PAYMENT_RECORDED", paymentMeta, { entityId: null })).details).toEqual(
      paymentMeta,
    );
  });

  it("rejects an email longer than 254 characters and still hides actorName", () => {
    const event = toAuditEvent(row("LOGIN_FAILED", { ...loginMeta, email: "a".repeat(255) }));
    expect(event.details).toBeNull();
    expect(event.actorName).toBeNull();
  });

  it("accepts an email at the 254-character limit", () => {
    const meta = { ...loginMeta, email: "a".repeat(254) };
    expect(toAuditEvent(row("LOGIN_FAILED", meta)).details).toEqual(meta);
  });

  it("preserves a missing actor name for non-login events", () => {
    expect(toAuditEvent(row("PRICE_CHANGED", priceMeta, { actorName: null })).actorName).toBeNull();
  });
});

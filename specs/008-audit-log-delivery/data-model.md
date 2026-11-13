# Data Model: Audit Log, Hardening and Delivery

**No schema change and no migration.** This phase only reads `audit_logs` (phase 1) and `users`.

## Stored: `audit_logs` (existing, append-only)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | second sort key (`DESC`) |
| `company_id` | uuid, nullable | filter = session company; `NULL` (failed login, unknown email) never matches |
| `user_id` | uuid, nullable | actor; for `LOGIN_FAILED` the targeted account (not returned) |
| `action` | enum | `LOGIN_FAILED`, `PRICE_CHANGED`, `CONTRACT_APPROVED`, `PAYMENT_RECORDED` |
| `entity_id` | uuid, nullable | unit id (price change), contract id (approval), payment id (payment) |
| `meta` | jsonb | written by the services below; parsed per action on read |
| `created_at` | timestamptz(3) | first sort key (`DESC`) |

Index used: `audit_logs(company_id, created_at)`. Triggers refuse `UPDATE` and `DELETE`.

## `meta` per action (as written today) → parse schema

| Action | Writer | `meta` keys read | Other source |
|---|---|---|---|
| `LOGIN_FAILED` | `src/features/auth/server/auth.service.ts` | `email` (string, ≤ 254), `reason` (`invalid_credentials` \| `locked`) | — |
| `PRICE_CHANGED` | `src/features/units/server/units.service.ts` | `oldPrice`, `newPrice` (int halalas ≥ 0) | unit id = `entity_id` |
| `CONTRACT_APPROVED` | `src/features/contracts/server/contracts.service.ts` | `unitPrice`, `finalPrice`, `downPayment` (int halalas ≥ 0), `installmentCount` (int ≥ 1), `startDate` (`YYYY-MM-DD`) | contract id = `entity_id` |
| `PAYMENT_RECORDED` | `src/features/payments/server/payments.service.ts` | `contractId` (uuid), `amount` (int > 0), `allocation` (`{ seq: int ≥ 0, applied: int > 0 }[]`), `remainingAfter` (int ≥ 0) | — |

Keys not listed (for example `unitId` on approval) are dropped. If `meta` fails its schema, or the needed
`entity_id` is null, `details` is `null`.

## DTO: `AuditEventDto` (JSON-safe; same from the service and the API)

```ts
type AuditEventBase = { id: string; createdAt: string /* ISO */; actorName: string | null };

type AuditEventDto = AuditEventBase &
  (
    | { action: "LOGIN_FAILED"; details: { email: string; reason: "invalid_credentials" | "locked" } | null }
    | { action: "PRICE_CHANGED"; details: { unitId: string; oldPrice: number; newPrice: number } | null }
    | {
        action: "CONTRACT_APPROVED";
        details: {
          contractId: string;
          unitPrice: number;
          finalPrice: number;
          downPayment: number;
          installmentCount: number;
          startDate: string; // YYYY-MM-DD, Asia/Riyadh
        } | null;
      }
    | {
        action: "PAYMENT_RECORDED";
        details: {
          contractId: string;
          amount: number;
          allocation: { seq: number; applied: number }[];
          remainingAfter: number;
        } | null;
      }
  );

type AuditLogPage = { items: AuditEventDto[]; total: number; page: number; pageSize: number };
```

Rules:

- `actorName` is `null` for `LOGIN_FAILED` (the UI shows `details.email`), and `null` when the user is missing or in
  another company than the session (R5).
- Money fields are integer halalas. The client formats them with `formatRiyals`.
- No `companyId`, `userId`, `entityId` of a payment, or raw `meta` is sent.

## Query: `AuditLogListQuery`

| Field | Rule | Default |
|---|---|---|
| `page` | digits, 1 … 100,000 | 1 |
| `pageSize` | digits, 1 … 50 | 20 |

Built from the shared `paginationFields`. Unknown keys are stripped. No filters (clarified).

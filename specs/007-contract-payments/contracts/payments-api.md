# Payments API

Both routes use the `handleRoute` wrapper (session required). Response shape `{ data }` or
`{ error: { code, message, fieldErrors? } }`. Money is integer halalas.

## GET /api/contracts/{id}/payments

Roles: `ACCOUNTANT`, `MANAGER`. `SALES` → 403 `FORBIDDEN`.

200:

```json
{ "data": { "approved": true, "remaining": 1234567, "payments": [
  { "id": "uuid", "amount": 500000, "createdAt": "2026-11-13T09:30:00.000Z" }
] } }
```

Payments newest first (`createdAt desc, id desc`). A draft returns `approved: false`, empty list.

| Case | Status | Code |
|---|---|---|
| `id` not a uuid | 400 | `VALIDATION_ERROR` |
| SALES | 403 | `FORBIDDEN` |
| other company / missing | 404 | `NOT_FOUND` |

## POST /api/contracts/{id}/payments

Role: `ACCOUNTANT`. Origin check applies. Header `Idempotency-Key: <1–100 chars>` (the form sends a UUID).

Body: `{ "amount": 500000 }` (integer halalas, 1 … 100,000,000,000). Other fields are stripped.

201 (new) or 200 (replay with the same key and amount): `{ "data": PaymentDto }`.

| Case | Status | Code | Message |
|---|---|---|---|
| bad amount / missing or bad key / bad id | 400 | `VALIDATION_ERROR` | `fieldErrors.amount` or `fieldErrors.idempotencyKey` |
| MANAGER or SALES | 403 | `FORBIDDEN` | static |
| other company / missing | 404 | `NOT_FOUND` | static |
| draft contract | 409 | `CONTRACT_NOT_APPROVED` | static |
| same key, different amount | 409 | `IDEMPOTENCY_KEY_REUSED` | includes the saved amount |
| amount > remaining | 409 | `PAYMENT_EXCEEDS_REMAINING` | includes the remaining amount |

No PUT, PATCH or DELETE exists for payments.

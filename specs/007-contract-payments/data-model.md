# Data Model: Payments

No schema change. All tables and constraints exist since phase 1 (and phase 5 for installment guards).

## Payment (`payments`, append-only)

| Field | Type | Rule |
|---|---|---|
| id | uuid | generated |
| contractId | uuid → contracts | must be an approved contract of the session company (checked in the service) |
| amount | bigint halalas | `> 0` (DB check); ≤ remaining at insert (service, under the contract lock) |
| idempotencyKey | text | not empty (DB check); 1–100 chars (Zod); unique with `contractId` (DB) |
| createdAt | timestamptz | DB `now()`; the payment date |

No update or delete (phase 1 triggers). No `company_id`: tenant filter goes through `contract.companyId`.

## Installment (`installments`, phase 5)

Only `paidAmount` changes here: `paidAmount += applied` for each allocated line. DB check `0 ≤ paid_amount ≤ amount`.

## Allocation (domain, not stored as a table)

`allocatePayment(lines, amount)`: lines ordered by `seq`, skip lines with `paidAmount = amount`, apply
`min(amount − paidAmount, left)` to each until `left = 0`. Result `[{ installmentId, seq, applied }]`, Σ applied =
amount. Stored only inside the audit row's `meta`.

## Audit row (`audit_logs`)

`action = PAYMENT_RECORDED`, `companyId`, `userId` (accountant), `entityId = payment id`,
`meta = { contractId, amount, allocation: [{ seq, applied }], remainingAfter }`. One row per new payment; none for a
replay.

## DTOs

- `PaymentDto { id: string; amount: number; createdAt: string /* ISO */ }`
- `ContractPaymentsDto { approved: boolean; remaining: number; payments: PaymentDto[] }`

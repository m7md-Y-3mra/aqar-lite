# Research: Payments

## R1. Serializing payments of one contract

- **Decision**: lock the contract row with `SELECT … FOR UPDATE` (only the `contracts` row, no joins) as the first
  statement of the transaction. The key check, the remaining-amount check and the writes all run after it.
- **Rationale**: under READ COMMITTED, each statement after the lock sees rows committed by the transaction that held
  it. So a second request (same key or not) sees the first payment and the new paid amounts. This gives FR-012,
  FR-017 and FR-018 with one mechanism, matching the agreed plan note.
- **Alternatives**: SERIALIZABLE with retries (more code, retry loop); relying on the unique index alone (stops
  duplicate keys but not overpayment by different keys).

## R2. Check order

- **Decision**: role → lock contract (missing/other company → 404) → not approved → key lookup (same amount → return
  original; different amount → `IDEMPOTENCY_KEY_REUSED`) → amount ≤ remaining → allocate → insert payment → add paid
  amounts → audit.
- **Rationale**: role and tenant first so a key never leaks across roles or companies; key before amount so a retry of
  an exact final payment is not a false overpayment (spec edge case).
- **Note**: the unique index `(contract_id, idempotency_key)` stays as the last guard; with R1 it is never hit, so no
  special handling of a unique violation is added (it would surface as a 500 and roll back).

## R3. Response for a replay

- **Decision**: new payment → 201; replay with the same amount → 200; both bodies are `{ data: PaymentDto }` for the
  same payment.
- **Rationale**: same result for the client (same payment); the status tells tests and logs it was a replay.

## R4. Messages that include an amount

- **Decision**: `AppError` gets an optional third argument `message`. `error-messages.ts` exports
  `paymentExceedsRemainingMessage(halalas)` and `idempotencyKeyReusedMessage(halalas)` (built with `formatRiyals`); the
  service passes the result. The route wrapper uses it instead of the static message.
- **Rationale**: the spec requires the remaining amount (FR-005) and the saved amount (FR-014) in the message. Arabic
  text stays in `error-messages.ts`; the change to the wrapper is a few lines.
- **Alternatives**: `fieldErrors.amount` on a 409 (the form shows non-400 errors at the top, so it would be lost);
  extra `details` field in the error body (changes the response shape).

## R5. Remaining amount for the payments view

- **Decision**: `listPayments` returns `remaining = finalPrice − Σ payments` along with the list. The record check uses
  `Σ (amount − paidAmount)` of the open lines, read after the lock.
- **Rationale**: both equal phase 5's `finalPrice − Σ paidAmount` by FR-009, and the integration test asserts the
  invariant. The client component then needs no contract data from another feature.

## R6. Where installment queries live

- **Decision**: installment reads and the `paid_amount` increment are new functions in the contracts repository,
  exported through `contracts/server/index.ts`. The payments repository touches only `payments`.
- **Rationale**: installments belong to contracts; payments → contracts is the allowed direction (AGENTS §2), same
  pattern as phase 5 using `units/server/index.ts`.

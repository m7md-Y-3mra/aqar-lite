# Implementation Plan: Payments

**Branch**: `claude/contract-payments-af18e9` | **Date**: 2026-11-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/007-contract-payments/spec.md`

**Gate before building**: phase 5 (`specs/006-contracts-installment-schedule`, branch
`claude/contracts-installment-schedule-699d4a`) must be merged into `main`, and this branch rebased onto it. Paths
marked **P5** below are phase 5 files as named in that phase's plan; check them after the rebase.

## Summary

An accountant records a payment on an approved contract. In one transaction the service locks the contract row,
handles a repeated `Idempotency-Key`, refuses an amount above the remaining amount, stores the payment, adds the
amount to the schedule lines from the lowest line number up (pure `allocatePayment`), and writes one
`PAYMENT_RECORDED` audit row with the allocation. The contract page gets a payments section (list plus form) for the
accountant and the manager, composed into the phase 5 contract page as a slot. No schema change.

## Technical Context

**Language/Version**: TypeScript (strict), Node 22 LTS

**Primary Dependencies**: as in phases 0–5. **No new dependency.**

**Storage**: PostgreSQL. `payments`: insert, read. `installments`: read, `paid_amount` increment. `contracts`: lock
(`FOR UPDATE`), read. `audit_logs`: insert. **No migration**: the phase 1 schema already has
`payments_contract_id_idempotency_key_key` (unique), `payments_amount_check` (> 0),
`payments_idempotency_key_check` (not empty), `installments_paid_amount_check` (0 ≤ paid ≤ amount) and the
append-only triggers on `payments` and `audit_logs`. Phase 5's installments trigger allows `paid_amount` updates.

**Testing**: Vitest. Unit tests (no DB) in `tests/unit`; integration tests on the real test database in
`tests/integration`.

**Target Platform**: Linux container (`docker compose up`); mobile and desktop browsers

**Project Type**: Web application (one Next.js project, feature folders)

**Performance Goals**: one payment = about 6 + N statements in one transaction (N = lines touched, at most 121).

**Constraints**: READ COMMITTED; the contract row lock serializes all payments of one contract. `companyId` only
from the session. Money is integer halalas ≤ 1e11 in `number`.

**Scale/Scope**: 1 new feature, 2 API handlers in 1 route file, 1 client component with 1 child, 3 phase 5 files
changed, 3 infrastructure files changed.

## Constitution Check

| Principle | Status | How |
|---|---|---|
| I. Tenant isolation | PASS | Every repository function takes `companyId`; payments and installments filter through `contract: { companyId }` (they have no `company_id` column). Other company → `NOT_FOUND`. Integration test: A's accountant on B's contract → 404 (record and list). |
| II. Server-side authorization | PASS | Service: record = `ACCOUNTANT` only; list = `ACCOUNTANT`, `MANAGER` (`SALES` → 403). Input schema allows only `amount`; key from the header; contract id from the path. |
| III. Financial accuracy | PASS | Halalas everywhere; `allocatePayment` is pure and unit-tested (partial, several lines, exact final, into a partial line, no down payment, sum invariant). Statuses and remaining stay computed (phase 5). |
| IV. Atomic and concurrency-safe | PASS | One `withTransaction`; contract `FOR UPDATE` before the key check and the amount check. Tests: same key twice (serial and parallel), different keys in parallel above remaining. |
| V. Database-enforced integrity | PASS | Existing unique, checks and append-only triggers (phase 1). No update or delete code for payments. |
| VI. Layered architecture | PASS | routes → service → repository; allocation in `domain/`; payments uses contracts only through `contracts/server/index.ts` (payments → contracts). Client composed by `page.tsx` slot; no cross-feature client import. |
| VII. Security by default | PASS | Zod on body, path and header; mutating route goes through the Origin check in `handleRoute`; generic 500; audit row per payment. |
| VIII. Scope discipline | PASS | No edit, delete, refund, method or date fields; no new dependency. |

## Project Structure

### Documentation (this feature)

```text
specs/007-contract-payments/
├── spec.md
├── plan.md              # this file
├── research.md          # R1–R6
├── data-model.md
├── quickstart.md
├── contracts/payments-api.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code: every file created or changed

```text
# Server infrastructure
src/server/http/error-codes.ts       change  + CONTRACT_NOT_APPROVED, PAYMENT_EXCEEDS_REMAINING, IDEMPOTENCY_KEY_REUSED: 409
src/server/http/app-error.ts         change  + optional third argument `message` (overrides the default Arabic message) (R4)
src/server/http/route-handler.ts     change  errorResponse uses err.message override when set

# Shared
src/shared/lib/error-messages.ts     change  + 3 static messages; + paymentExceedsRemainingMessage(halalas), idempotencyKeyReusedMessage(halalas) built with formatRiyals (R4)

# Contracts feature (P5 files)
src/features/contracts/server/contracts.repository.ts  P5 change  + lockContractForPayment(companyId, id, tx) ($queryRaw SELECT id, final_price, approved_at FROM contracts WHERE id AND company_id FOR UPDATE); + findPaymentContract(companyId, id, tx?) (same fields, no lock); + findOpenInstallments(companyId, contractId, tx) (paid_amount < amount, ORDER BY seq); + addInstallmentPaid(companyId, installmentId, halalas, tx) (updateMany WHERE id AND contract.companyId, increment → count)
src/features/contracts/server/index.ts                 P5 change  + export the four functions above
src/features/contracts/client/contract-details/contract-details.tsx  P5 change  render optional `paymentsSlot` under the schedule when approved
src/features/contracts/client/contract-details/types.ts              P5 change  + paymentsSlot?: ReactNode
src/app/(app)/contracts/[id]/page.tsx                                P5 change  ACCOUNTANT/MANAGER: prefetch paymentKeys.list(id) via listPayments; pass <ContractPayments contractId role relatedQueryKeys={[contractKeys.all]} /> as paymentsSlot

# Payments feature (new)
src/features/payments/payments.schemas.ts      new  paymentSchema (amount: int halalas 1..1e11), recordPaymentInputSchema (.pick amount), idempotencyKeySchema (string 1..100, trimmed), contractIdParamSchema reused from contracts.schemas (P5) or z.uuid()
src/features/payments/payments.types.ts        new  PaymentDto { id, amount, createdAt }, ContractPaymentsDto { approved, remaining, payments }, RecordPaymentInput
src/features/payments/payments.keys.ts         new  paymentKeys.all / list(contractId)
src/features/payments/domain/allocation.ts     new  AllocationLine { id, seq, amount, paidAmount }; Allocation { installmentId, seq, applied }[]; allocatePayment(lines, amount) (throws if amount > open total)
src/features/payments/server/payments.repository.ts  new  findPaymentByKey(companyId, contractId, key, tx); insertPayment(companyId, contractId, amount, key, tx) (first checks the contract is in companyId); findPayments(companyId, contractId, tx?) (newest first, id tie-break); sumPayments(companyId, contractId, tx?)
src/features/payments/server/payments.service.ts     new  recordPayment(user, contractId, input, key) → { payment, replayed }; listPayments(user, contractId) → ContractPaymentsDto
src/features/payments/server/payments.routes.ts      new  listPaymentsHandler (GET), recordPaymentHandler (POST: parse path, body, Idempotency-Key header → 201 new / 200 replay)
src/features/payments/server/index.ts                new  route handlers; listPayments (page prefetch)
src/features/payments/client/payments.queries.ts     new  contractPaymentsOptions(contractId) via queryOptions(); recordPayment(contractId, amount, key) fetcher sending the header
src/features/payments/client/contract-payments/contract-payments.tsx   new  useQuery; loading / empty / error; payments table (amount, Saudi date-time); fully-paid note; renders RecordPaymentForm for ACCOUNTANT when remaining > 0
src/features/payments/client/contract-payments/types.ts                new  ContractPaymentsProps { contractId; role; relatedQueryKeys }
src/features/payments/client/contract-payments/index.ts                new
src/features/payments/client/contract-payments/components/record-payment-form/record-payment-form.tsx  new  MoneyInput amount; remaining shown; root error at top; button disabled while pending
src/features/payments/client/contract-payments/components/record-payment-form/use-record-payment-form.ts new  key = useState(crypto.randomUUID()); zodResolver(recordPaymentInputSchema); useMutation; success → toast, reset, new key, invalidate; 409 → applyApiError + invalidate; IDEMPOTENCY_KEY_REUSED → also new key
src/features/payments/client/contract-payments/components/record-payment-form/types.ts  new
src/features/payments/client/contract-payments/components/record-payment-form/index.ts  new

# Routing
src/app/api/contracts/[id]/payments/route.ts   new  export { listPaymentsHandler as GET, recordPaymentHandler as POST }

# Tests
tests/unit/features/payments/domain/allocation.test.ts                 new
tests/unit/features/payments/payments.schemas.test.ts                  new
tests/integration/features/payments/server/payments.service.test.ts    new
tests/integration/features/payments/server/payments.routes.test.ts     new
tests/integration/support/db-fixtures.ts                               unchanged (makeContractChain, makeInstallment, makePayment exist)

# Docs
README.md        change  Assumptions (spec Assumptions incl. the two clarifications and the plan-note change), Technical decisions (R1–R3), Security (payment race and replay)
```

**Structure Decision**: same single Next.js project and feature-folder layout as phases 3–5.

## Rule → test map

`alloc` = `tests/unit/features/payments/domain/allocation.test.ts`, `schemas` =
`tests/unit/features/payments/payments.schemas.test.ts`, `svc` =
`tests/integration/features/payments/server/payments.service.test.ts`, `routes` =
`tests/integration/features/payments/server/payments.routes.test.ts`.

| Rule (spec) | Test |
|---|---|
| FR-001 accountant only; other company 404 | `svc` › "MANAGER cannot record → FORBIDDEN", "SALES cannot record → FORBIDDEN, no payment", "accountant of B on A's contract → NOT_FOUND"; `routes` › "SALES POST → 403" |
| FR-002 draft refused | `svc` › "draft contract → CONTRACT_NOT_APPROVED, no payment" |
| FR-003 only amount + key accepted | `schemas` › "extra keys are stripped"; `svc` › "payment belongs to the session company's contract" |
| FR-004 amount validation | `schemas` › "0, negative, non-integer, above 1e11 → error"; `routes` › "amount 0 → 400 with fieldErrors.amount" |
| FR-005 overpayment refused, names remaining | `svc` › "amount above remaining → PAYMENT_EXCEEDS_REMAINING, nothing changes"; `routes` › "409 message contains the remaining amount" |
| FR-006 date = server time | `svc` › "createdAt set by the DB" |
| FR-007 / FR-008 allocation order and exact sum | `alloc` › "partial payment", "covers several lines and part of the next", "exact final payment", "into an already partial line", "no down payment starts at seq 1", "applied always sums to amount and never overfills (loop)", "amount above open total throws" |
| FR-009 Σ payments = Σ paid ≤ final | `svc` › "after several payments Σ payments = Σ paidAmount ≤ finalPrice" |
| FR-010 statuses follow phase 5 | phase 5 `installment-status.test.ts` (reused); `svc` › "lines updated as allocation says" |
| FR-011 key required, ≤ 100 | `schemas` › "empty / 101 chars → error"; `routes` › "missing header → 400" |
| FR-012 same key → original, before amount check | `svc` › "same key twice → one payment, one audit row, same payment returned", "retry after exact final payment returns the original"; `routes` › "replay → 200 with same body" |
| FR-013 key scoped per contract | `svc` › "same key on another contract → second payment" |
| FR-014 same key, other amount → 409 | `svc` › "same key, different amount → IDEMPOTENCY_KEY_REUSED, payment count unchanged"; `routes` › "409 message contains the saved amount" |
| FR-015 form key lifecycle | quickstart §3 (manual) |
| FR-016 all-or-nothing | `svc` › "forced audit failure → no payment, paid amounts unchanged" (same technique as phase 5 R13) |
| FR-017 / FR-018 concurrency | `svc` › "parallel same key → one payment" (×5), "parallel 6,000 + 6,000 on 10,000 → one succeeds, other PAYMENT_EXCEEDS_REMAINING" (×5) |
| FR-019 no edit/delete | `routes` › "payments route exports only GET and POST"; phase 1 `append-only.test.ts` (reused) |
| FR-020 audit row with allocation | `svc` › "one PAYMENT_RECORDED row with amount, allocation [{seq, applied}], remainingAfter" |
| FR-021 / FR-022 viewing by role | `svc` › "list newest first for ACCOUNTANT and MANAGER", "SALES list → FORBIDDEN (own contract too)", "B lists A's → NOT_FOUND" |
| FR-023–FR-027 UI | quickstart §2–§4 (manual) |
| FR-028 / FR-029 test lists | rows above |

## Complexity Tracking

None. No constitution violation.

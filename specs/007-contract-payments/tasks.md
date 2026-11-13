# Tasks: Payments

**Input**: `specs/007-contract-payments/` (spec.md, plan.md, research.md, data-model.md, contracts/payments-api.md,
quickstart.md)

**Gate**: do not start until phase 5 is merged into `main` and this branch is rebased onto it (T001).

**Tests**: required by the spec (FR-028, FR-029) and the constitution (I, III, IV). Write each test task before the
code it proves; it must fail first.

## Format: `[ID] [P?] [Story] Description`

- **Status**: T001–T024 done. T025 (`/security-review`) is left for the reviewer. The manual walk covered quickstart §2 (record, refresh, overdue partial line, overpayment message); §3 (offline retry) and §4 (rep and manager views) are covered by integration tests, not by hand.
- **[P]**: can run in parallel (different files, no unfinished dependency)
- Commit after each task (or small group) with a Conventional Commit.

---

## Phase 1: Setup

- [x] T001 Rebase `claude/contract-payments-af18e9` onto `main` after phase 5 merges; check the **P5** paths in plan.md exist (`src/features/contracts/server/contracts.repository.ts`, `src/features/contracts/server/index.ts`, `src/features/contracts/client/contract-details/contract-details.tsx`, `src/app/(app)/contracts/[id]/page.tsx`); run `npm run test` green

---

## Phase 2: Foundational (blocks all stories)

- [x] T002 [P] Add `CONTRACT_NOT_APPROVED`, `PAYMENT_EXCEEDS_REMAINING`, `IDEMPOTENCY_KEY_REUSED` (all 409) in src/server/http/error-codes.ts, and their static Arabic messages plus `paymentExceedsRemainingMessage(halalas)` and `idempotencyKeyReusedMessage(halalas)` (use `formatRiyals`) in src/shared/lib/error-messages.ts
- [x] T003 Add optional third argument `message?: string` to `AppError` in src/server/http/app-error.ts and make `errorResponse` in src/server/http/route-handler.ts use it when set (research R4); existing calls unchanged. *Built:* the field is `userMessage` (`Error.message` already holds the code)
- [x] T004 [P] Create src/features/payments/payments.schemas.ts (`paymentSchema` with `amount` int halalas 1…100_000_000_000 and Arabic messages; `recordPaymentInputSchema = paymentSchema.pick({ amount: true })`; `idempotencyKeySchema` trimmed string 1–100; contract id param `z.uuid()`; *built as* `paymentContractIdSchema`, with `MAX_IDEMPOTENCY_KEY_LENGTH = 100`), src/features/payments/payments.types.ts (`PaymentDto`, `ContractPaymentsDto`, `RecordPaymentInput`) and src/features/payments/payments.keys.ts (`paymentKeys.all`, `paymentKeys.list(contractId)`)
- [x] T005 [P] Unit tests in tests/unit/features/payments/payments.schemas.test.ts: amount 0 / negative / non-integer / above 1e11 rejected; extra keys stripped; key empty or 101 chars rejected, 100 accepted
- [x] T006 [P] Add to src/features/contracts/server/contracts.repository.ts: `lockContractForPayment(companyId, id, tx)` (`$queryRaw` `SELECT id, final_price, approved_at FROM contracts WHERE id = … AND company_id = … FOR UPDATE`, contracts row only), `findPaymentContract(companyId, id, tx?)` (same fields, no lock), `findOpenInstallments(companyId, contractId, tx)` (`paidAmount < amount`, order by `seq`, filter `contract: { companyId }`), `addInstallmentPaid(companyId, installmentId, halalas, tx)` (`updateMany` where `id` and `contract: { companyId }`, `paidAmount: { increment }`, return count); export all four from src/features/contracts/server/index.ts. *Built:* the existing phase 5 `lockContract` already locks only the contract row (`FOR UPDATE OF c`) and returns `finalPrice` and `approvedAt`, so it is reused and exported instead of a new lock function; the unlocked read is `findContractTotals`

**Checkpoint**: infrastructure ready.

---

## Phase 3: User Story 1 — Accountant records a payment (P1) 🎯 MVP

**Goal**: an accountant records a payment on an approved contract; it is allocated lowest line first, audited, and
refused when above the remaining amount, on a draft, for other roles or other companies.

**Independent test**: approve a contract via fixtures, record one payment through the service, check lines, remaining
and audit row.

### Tests (write first)

- [x] T007 [P] [US1] Unit tests in tests/unit/features/payments/domain/allocation.test.ts: partial payment (one line partial); covers several lines and part of the next; exact final payment (all lines full); into an already partial line; no down payment (lines start at seq 1); loop over many inputs: Σ applied = amount and no line overfilled; amount above open total throws
- [x] T008 [P] [US1] Integration tests in tests/integration/features/payments/server/payments.service.test.ts (use `makeContractChain`, `makeInstallment` from tests/integration/support/db-fixtures.ts): success updates lines per allocation and writes one `PAYMENT_RECORDED` row with `{ contractId, amount, allocation: [{ seq, applied }], remainingAfter }`; overpayment → `PAYMENT_EXCEEDS_REMAINING`, nothing changes; draft → `CONTRACT_NOT_APPROVED`, no payment; MANAGER and SALES → `FORBIDDEN`, no payment; accountant of company B on A's contract → `NOT_FOUND`; Σ payments = Σ paidAmount ≤ finalPrice after several payments; forced audit failure (same technique as phase 5 R13) → no payment, paid amounts unchanged

### Implementation

- [x] T009 [US1] Implement `allocatePayment(lines, amount)` in src/features/payments/domain/allocation.ts (pure, no imports from DB or framework; data-model.md "Allocation")
- [x] T010 [US1] Create src/features/payments/server/payments.repository.ts (`import "server-only"`): `findPaymentByKey(companyId, contractId, key, tx)`, `insertPayment(companyId, contractId, amount, key, tx)` (first check the contract belongs to `companyId`, else `NOT_FOUND`), `findPayments(companyId, contractId, tx?)` (createdAt desc, id desc), `sumPayments(companyId, contractId, tx?)`; every query filters by `contract: { companyId }`. *Built:* `insertPayment(companyId, { contractId, amount, idempotencyKey }, tx)` is one `INSERT … SELECT FROM contracts WHERE id AND company_id` and returns `null` for another company's contract (the service throws `NOT_FOUND`); `sumPayments` returns a `bigint`. Typechecked only; not yet run against a database (the shared test DB belongs to other worktrees). T008 is its first real proof after the rebase
- [x] T011 [US1] Create `recordPayment(user, contractId, input, key)` in src/features/payments/server/payments.service.ts following research R2 order: role ≠ ACCOUNTANT → `FORBIDDEN`; `withTransaction`: `lockContractForPayment` (null → `NOT_FOUND`), `approvedAt` null → `CONTRACT_NOT_APPROVED`, key lookup (T014 fills this in), open lines → remaining; amount > remaining → `AppError("PAYMENT_EXCEEDS_REMAINING", undefined, paymentExceedsRemainingMessage(remaining))`; `allocatePayment`; `insertPayment`; `addInstallmentPaid` per allocation (count ≠ 1 → throw); `insertAuditLog` (from src/server/audit/audit.repository.ts) with the meta above; return `{ payment: PaymentDto, replayed: false }`
- [x] T012 [US1] Create src/features/payments/server/payments.routes.ts with `recordPaymentHandler` (`handleRoute({ auth: "user" })`; parse path id, body with `recordPaymentInputSchema`, header `Idempotency-Key` with `idempotencyKeySchema` (error → `VALIDATION_ERROR` with `fieldErrors.idempotencyKey`); 201 for new, 200 for replay), src/features/payments/server/index.ts (export handlers and `listPayments`), and src/app/api/contracts/[id]/payments/route.ts (`export { listPaymentsHandler as GET, recordPaymentHandler as POST }`)
- [x] T013 [P] [US1] Integration tests in tests/integration/features/payments/server/payments.routes.test.ts: SALES POST → 403; amount 0 → 400 with `fieldErrors.amount`; missing header → 400; overpayment 409 message contains the remaining amount; route module exports only `GET` and `POST`

**Checkpoint**: US1 works through the API; `npm run test` green.

---

## Phase 4: User Story 2 — A repeated request never creates a second payment (P1)

**Goal**: same key + same amount returns the original payment; same key + other amount → 409; key scoped per contract.

**Independent test**: send the same request twice (serial and parallel) and count payments.

- [x] T014 [US2] Add to tests/integration/features/payments/server/payments.service.test.ts: same key twice → one payment, one audit row, same payment returned with `replayed: true`; retry after an exact final payment returns the original (not `PAYMENT_EXCEEDS_REMAINING`); same key on another contract → second payment; same key with a different amount → `IDEMPOTENCY_KEY_REUSED`, message contains the saved amount, payment count unchanged; parallel `Promise.all` of the same request (×5 rounds) → exactly one payment
- [x] T015 [US2] In `recordPayment` (src/features/payments/server/payments.service.ts), after the not-approved check and before the amount check: `findPaymentByKey`; same amount → return `{ payment, replayed: true }` with no writes; different amount → `AppError("IDEMPOTENCY_KEY_REUSED", undefined, idempotencyKeyReusedMessage(existing.amount))`
- [x] T016 [P] [US2] Add to tests/integration/features/payments/server/payments.routes.test.ts: replay → 200 with the same body as the first 201; different amount → 409 `IDEMPOTENCY_KEY_REUSED`

---

## Phase 5: User Story 3 — Two accountants pay at the same moment (P1)

**Goal**: the contract row lock keeps the total paid ≤ final price under concurrent requests (research R1).

**Independent test**: parallel payments with different keys.

- [x] T017 [US3] Add to tests/integration/features/payments/server/payments.service.test.ts: remaining 10,000 riyals, `Promise.all` of two 6,000 payments with different keys (×5 rounds) → exactly one succeeds, the other `PAYMENT_EXCEEDS_REMAINING`; two 4,000 payments → both succeed, remaining 2,000. If it fails, fix the lock in `lockContractForPayment` (must be the first statement in the transaction)

---

## Phase 6: User Story 4 — See a contract's payments and the updated schedule (P2)

**Goal**: accountant and manager see the payments list; the accountant records from the contract page; sales reps
get 403.

**Independent test**: open a contract with two payments as accountant and manager; as a rep, GET → 403.

- [x] T018 [US4] Add to tests/integration/features/payments/server/payments.service.test.ts: `listPayments` newest first with `remaining` and `approved` for ACCOUNTANT and MANAGER; SALES → `FORBIDDEN` (own contract too); company B → `NOT_FOUND`
- [x] T019 [US4] Implement `listPayments(user, contractId)` in src/features/payments/server/payments.service.ts (SALES → `FORBIDDEN`; `findPaymentContract` null → `NOT_FOUND`; draft → `{ approved: false, remaining: finalPrice, payments: [] }`; else `remaining = finalPrice − sumPayments`) and `listPaymentsHandler` in src/features/payments/server/payments.routes.ts
- [x] T020 [P] [US4] Create src/features/payments/client/payments.queries.ts: `contractPaymentsOptions(contractId)` with `queryOptions()` and `paymentKeys.list`; `recordPayment(contractId, amount, key)` with `apiFetch`, header `Idempotency-Key`
- [x] T021 [US4] Create src/features/payments/client/contract-payments/ (`contract-payments.tsx`, `types.ts`, `index.ts`): `useQuery(contractPaymentsOptions)`; loading / empty / error states; table of amount (`formatRiyals`) and Saudi date-time; "fully paid" note when remaining is 0; renders `RecordPaymentForm` only for ACCOUNTANT and remaining > 0. Props `{ contractId, role, relatedQueryKeys }`. Logical RTL classes only
- [x] T022 [US4] Create src/features/payments/client/contract-payments/components/record-payment-form/ (`record-payment-form.tsx`, `use-record-payment-form.ts`, `types.ts`, `index.ts`): `MoneyInput` amount with remaining shown; key in `useState(() => crypto.randomUUID())`; RHF + `zodResolver(recordPaymentInputSchema)`; `useMutation`; button disabled while pending; success → sonner toast, reset, new key, invalidate `paymentKeys.list(contractId)` and `relatedQueryKeys`; error → `applyApiError` (409 at top); on any 409 invalidate the same keys; on `IDEMPOTENCY_KEY_REUSED` also make a new key
- [x] T023 [US4] Add `paymentsSlot?: ReactNode` to src/features/contracts/client/contract-details/types.ts and render it under the schedule for approved contracts in src/features/contracts/client/contract-details/contract-details.tsx; in src/app/(app)/contracts/[id]/page.tsx, for ACCOUNTANT and MANAGER prefetch `paymentKeys.list(id)` with `listPayments` and pass `<ContractPayments contractId role relatedQueryKeys={[contractKeys.all]} />` as `paymentsSlot`

**Checkpoint**: quickstart §2–§4 pass by hand.

---

## Phase 7: Polish

- [x] T024 Update README.md: Assumptions (spec Assumptions, both clarifications, the change from the phase 6 plan note), Technical decisions (research R1–R3), Security (payment race and replay)
- [ ] T025 Run `npm run lint && npm run typecheck && npm run test`, walk quickstart.md, then `/security-review`

---

## Dependencies & Execution Order

- T001 → Phase 2 → US1 → (US2, US3, US4). US2, US3 and US4 all touch `payments.service.ts` / its test file, so run
  them one after another; US4's client tasks T020–T022 can run beside US2/US3.
- Within a story: tests first, then code.

### Parallel examples

- Phase 2: T002, T004, T005, T006 together (T003 after T002).
- US1: T007 and T008 together; then T009 and T010 together; T013 beside T011–T012.
- US4: T020 beside T018–T019.

## Implementation Strategy

- MVP = Phases 1–3 (US1): payments recordable and safe through the API.
- Then US2 and US3 (both P1, mostly tests on the same lock), then US4 UI, then polish.

## Rule coverage

Every FR maps to a test in plan.md "Rule → test map"; the tasks above create each of those tests.

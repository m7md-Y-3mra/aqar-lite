---
description: "Task list for phase 5: contracts and installment schedule"
---

# Tasks: Contracts and Installment Schedule

**Input**: Design documents from `specs/006-contracts-installment-schedule/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/contracts-api.md](./contracts/contracts-api.md), [quickstart.md](./quickstart.md)

**Tests**: Required. The user's "done when" asks for:
- unit tests: 31 January, a leap-year February, 100,000 over 3, a down payment of 0, and the sum always equal to the final price;
- integration tests: approval is all-or-nothing, and an approved contract cannot be edited.

Constitution I adds the cross-company test. Integration tests use the real test DB (never mocks). Test titles are the `it(...)` names from the plan's proof map. Tests are written first only where the proof map needs them (domain and approval); elsewhere a task writes the code and its tests together.

**Time budget**: minimal tasks (user, 2026-11-13: about 8 hours left for contracts, payments and delivery). One task per file group. Do not add anything that is not in plan.md.

**Commits**: one small Conventional Commit per task (AGENTS §9). Before marking a phase done, run `npm run lint && npm run typecheck && npm run test`, plus `npm run test:integration` with `docker compose up -d db`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1–US4 from spec.md (US1 create draft, US2 approve, US3 edit, US4 view)

## Names used from phases 3 and 4

Check these against the rebased code in T001, and update the task text if a name differs:

| Name | From | Where |
|---|---|---|
| `requireUser()`, `SessionUser { userId, companyId, role, name, companyName }` | phase 2 | `src/server/auth/require-user.ts`, `src/server/auth/session.service.ts` |
| `handleRoute`, `readJson`, `AppError`, `withTransaction`, `Tx`, `isUniqueViolation`, `insertAuditLog` | phases 0–2 | `src/server/http/*`, `src/server/db.ts`, `src/server/audit/audit.repository.ts` |
| `reserveUnitIfAvailable`, `findUnitStatus`, `releaseExpired` (lock-then-recheck) | phase 4 | `src/features/units/server/units.repository.ts`, `index.ts` |
| `formatRiyadhDateTime` | phase 4 | `src/shared/lib/dates.ts` |
| `ReservationDto`, `reservationKeys`, reservations table | phase 4 | `src/features/reservations/**` |
| `paginationFields`, `Page<T>`, `toSkip`, `toQueryInput`, `parseRiyals`, `formatRiyals` | phase 3 | `src/shared/lib/*` |
| `apiFetch`, `applyApiError`, `MoneyInput`, `EmptyState`, `ErrorState`, `TableSkeleton`, `PaginationNav`, `NotFoundMessage`, UI `table`/`badge`/`card`/`alert`/`button` | phases 2–3 | `src/shared/**` |
| `makeTwoCompanies()`, `makeSessionUser()`, `makeUnit`, `makeClient`, `makeReservation`, `makeContract`, `makeInstallment`, `apiRequest` | phases 1–3 | `tests/integration/support/*` |

---

## Phase 1: Setup

- [ ] T001 Gate:
  - confirm phase 4 is merged into `main`, and rebase this branch onto it;
  - run `npm run lint && npm run typecheck && npm run test && npm run test:integration` and confirm all green before any change;
  - check every name in the table above against the code, and fix this file's task text where a name differs.

---

## Phase 2: Foundational (blocks every story)

**Purpose**: pure domain, DB guards, error codes, schemas, repository and the detail read model that every story returns.

- [ ] T002 [P] Write the domain unit tests first (they must fail) in three files: `tests/unit/features/contracts/domain/schedule.test.ts`, `tests/unit/features/contracts/domain/pricing.test.ts` and `tests/unit/features/contracts/domain/installment-status.test.ts`.
  - **`schedule`**:
    - "100,000 over 3 → 33,333 / 33,333 / 33,334";
    - "31 January start → 28 Feb, 31 Mar, 30 Apr" (start `2027-01-31`);
    - "31 January 2028 → 29 February 2028";
    - "29 February 2028 + 12 → 28 February 2029";
    - "each date counts from the start, not the previous line";
    - "down payment is line 0 due on the start date";
    - "down payment 0 → no seq 0, first line one month after start";
    - "remainder with halalas goes to the last line";
    - "every line is at least 100 halalas for valid terms";
    - "sum equals finalPrice for every combination": a loop over finalPrice/downPayment with and without halalas × installmentCount 1…120, skipping terms where rest < n·100.
  - **`pricing`**:
    - "475,000 for 500,000";
    - "rounds 95% up to the next halala (unit price 1 → 1)";
    - "matches a BigInt ceiling for 10,000 sampled prices up to 1e11".
  - **`status`**:
    - "paid when paidAmount equals amount, even past due";
    - "overdue when unpaid and due before today";
    - "overdue wins over partial";
    - "partial when part paid and due today or later";
    - "unpaid when nothing paid and due today (not overdue)";
    - "down payment due on the approval date is overdue the next day";
    - "contractRemaining subtracts all paid amounts".
- [ ] T003 Implement the pure domain (no DB or framework imports; `date-fns` + `@date-fns/tz` only) so that T002 passes. Three files:
  - `src/features/contracts/domain/schedule.ts`:
    - `MAX_INSTALLMENTS = 120`;
    - `ScheduleTerms`, `ScheduleLine { seq, dueDate: "YYYY-MM-DD", amount }`;
    - `buildSchedule(terms, startDate)` per research R1: `base = Math.floor(rest / (n * 100)) * 100`, last line = `rest − base·(n−1)`, due = `format(addMonths(new TZDate(y, m−1, d, "Asia/Riyadh"), i), "yyyy-MM-dd")`;
    - `scheduleTotal(lines)`.
  - `src/features/contracts/domain/pricing.ts`: `minFinalPrice(unitPrice) = Math.ceil(unitPrice * 95 / 100)`, exactly as agreed.
  - `src/features/contracts/domain/installment-status.ts`: `installmentStatus({ amount, paidAmount, dueDate }, today)` with the order PAID → OVERDUE (`dueDate < today`) → PARTIAL → UNPAID, and `contractRemaining(finalPrice, lines)`.
- [ ] T004 [P] Add `toRiyadhDate(instant: Date): string` (`format(new TZDate(instant, "Asia/Riyadh"), "yyyy-MM-dd")`) and `formatRiyadhDate(ymd: string): string` (`yyyy/MM/dd`) to `src/shared/lib/dates.ts`. Add tests to `tests/unit/shared/lib/dates.test.ts`:
  - "toRiyadhDate(2027-01-30T22:00Z) is 2027-01-31";
  - "formatRiyadhDate".
- [ ] T005 [P] Create the migration with `npx prisma migrate dev --create-only --name contracts_guards` and fill `prisma/migrations/<timestamp>_contracts_guards/migration.sql` per research R9:
  - `contracts_final_price_max_check CHECK (final_price <= 100000000000)`;
  - trigger function and trigger `contracts_approved_immutable` (`BEFORE UPDATE OR DELETE ON contracts`, raise when `OLD.approved_at IS NOT NULL`);
  - trigger `installments_terms_immutable`:
    - `BEFORE UPDATE`: raise if `contract_id`, `seq`, `due_date` or `amount` changes;
    - `BEFORE DELETE`: raise.

  Apply it. Write `tests/integration/prisma/contracts-guards.test.ts`:
  - "final_price above 1e11 fails (23514)";
  - "UPDATE of an approved contract fails";
  - "DELETE of an approved contract fails";
  - "UPDATE of a draft succeeds";
  - "UPDATE installments SET amount fails";
  - "UPDATE installments SET paid_amount succeeds";
  - "DELETE installment fails".
- [ ] T006 [P] Error codes:
  - add `CONTRACT_EXISTS`, `CONTRACT_ALREADY_APPROVED`, `CONTRACT_CHANGED` and `RESERVATION_EXPIRED` (all 409) to `src/server/http/error-codes.ts`;
  - add their Arabic messages (research R10, word for word) to `src/shared/lib/error-messages.ts`;
  - update `tests/unit/shared/lib/error-messages.test.ts` if it lists the codes.
- [ ] T007 Feature contracts:
  - `src/features/contracts/contracts.schemas.ts`:
    - `contractSchema`: id, reservationId, finalPrice 1…1e11, downPayment 0…1e11, installmentCount 1…`MAX_INSTALLMENTS`, with Arabic messages;
    - `contractTermsRefine`: `downPayment < finalPrice` → `downPayment`; `finalPrice − downPayment >= installmentCount × 100` → `installmentCount`;
    - `contractTermsInputSchema` (`.pick` terms + refine) and `createContractInputSchema` (`.pick` reservationId + terms + refine);
    - `contractIdSchema`, `contractListQuerySchema` (paginationFields only), `contractOptionsQuerySchema` (`.pick` reservationId).
  - `src/features/contracts/contracts.types.ts`: the DTOs from contracts/contracts-api.md, plus `ContractOptionsDto` and `ContractPage`.
  - `src/features/contracts/contracts.keys.ts`: `contractKeys.all`, `list(query)`, `detail(id)`, `options(reservationId)`.

  Write `tests/unit/features/contracts/contracts.schemas.test.ts`:
  - "create input strips approvedAt, companyId, status, schedule, salesRepId";
  - "downPayment equal to finalPrice → error on downPayment";
  - "negative downPayment → error";
  - "installmentCount 0, 121 and 1.5 → error";
  - "1 and 120 accepted";
  - "2 riyals over 3 installments → error on installmentCount";
  - "3 riyals over 3 accepted";
  - "pageSize 51 → error";
  - "defaults 1 / 20";
  - "unknown status key is stripped".
- [ ] T008 Units exports for approval (research R12):
  - in `src/features/units/server/units.repository.ts` add:
    - `lockUnit(companyId, unitId, tx)`: `$queryRaw SELECT status FROM units WHERE id = … AND company_id = … FOR UPDATE`, returns the status or null;
    - `markUnitSold(companyId, unitId, tx)`: `updateMany WHERE { id, companyId, status: "RESERVED" } → SOLD`, returns the count;
  - export both from `src/features/units/server/index.ts`.
- [ ] T009 Contracts repository `src/features/contracts/server/contracts.repository.ts` (`import "server-only"`). Every function takes `companyId` and an optional or required `tx` as in plan.md:
  - `dbNow`, `dbClock` (`SELECT clock_timestamp()`);
  - `findOwnReservation` (with unit price, client, contract id);
  - `insertContract`;
  - `findContract(companyId, id, { salesRepId? })` (with reservation, unit, client, salesRep, installments ordered by seq);
  - `findContracts` / `countContracts(companyId, { salesRepId?, skip, take })`, ordered `[{ approvedAt: { sort: "desc", nulls: "first" } }, { id: "asc" }]`;
  - `sumPaidByContract` (`installment.groupBy`);
  - `updateDraftTerms` (`updateMany WHERE approvedAt null` → count);
  - `lockContract` (`$queryRaw … FOR UPDATE`, joined to `reservations.expires_at`, `unit_id` and the unit price);
  - `markApproved` (`updateMany WHERE approvedAt null` → count);
  - `insertInstallments` (`createMany`; `dueDate: new Date(`${ymd}T00:00:00.000Z`)`, research R8).

  Write `tests/integration/features/contracts/server/contracts.repository.test.ts`:
  - "every query filters by companyId" (company B rows never returned or updated);
  - "stored due date reads back as the same YYYY-MM-DD".
- [ ] T010 Detail read model:
  - in `src/features/contracts/server/contracts.service.ts` add `toDetailDto` and `getContract(user, id)`:
    - SALES scoped by `salesRepId`; none → `NOT_FOUND`;
    - `today = toRiyadhDate(await dbNow())`;
    - draft → `buildSchedule(terms, today)`, `estimated: true`, no paid/status;
    - approved → stored lines + `installmentStatus`, `estimated: false`;
    - `remaining`, `reservationExpired`, `minFinalPrice`;
  - `getContractHandler` in `src/features/contracts/server/contracts.routes.ts` (path id via `contractIdSchema.safeParse` → 404);
  - `src/features/contracts/server/index.ts`;
  - `src/app/api/contracts/[id]/route.ts` exporting `GET`.

**Checkpoint**: domain tests green, migration applied, a draft row made by fixture is readable through `getContract`.

---

## Phase 3: User Story 1 — Sales rep creates a draft with a preview (P1) 🎯 MVP

**Goal**: a rep creates a draft from their own active reservation and sees the schedule preview while typing.

**Independent test**: quickstart §2. 100,000 / 0 / 3 previews 33,333 / 33,333 / 33,334. Save creates a draft and the unit stays RESERVED.

- [ ] T011 [US1] Server create path:
  - in `src/features/contracts/server/contracts.service.ts`:
    - `getContractOptions(user, reservationId)`: SALES only; own reservation else `NOT_FOUND`; returns `minFinalPrice`, `today`, `contractId`;
    - `createContract(user, input)` per research R3: SALES → own reservation → `CONTRACT_EXISTS` → `RESERVATION_EXPIRED` (`expiresAt <= dbNow`) → `minFinalPrice` (`VALIDATION_ERROR` on `finalPrice` naming the minimum with `formatRiyals`) → insert, mapping a unique violation on `contracts_reservation_id_key` or `contracts_company_id_reservation_id_key` to `CONTRACT_EXISTS`;
  - `createContractHandler` (201) and `contractOptionsHandler` in `contracts.routes.ts`;
  - `src/app/api/contracts/route.ts` exporting `POST` (GET is added in T019);
  - `src/app/api/contracts/options/route.ts` exporting `GET`.

  Tests in `tests/integration/features/contracts/server/contracts.service.test.ts`:
  - "create › rep creates a draft: approvedAt null, no installments, unit RESERVED";
  - "create › second contract for the same reservation → CONTRACT_EXISTS";
  - "create › expired reservation → RESERVATION_EXPIRED, no contract";
  - "create › final price one halala below the minimum → VALIDATION_ERROR on finalPrice naming the minimum";
  - "create › final price equal to the minimum is accepted";
  - "create › final price above the unit price is accepted";
  - "create › ignores hand-sent approvedAt and status";
  - "role checks › MANAGER cannot create", "role checks › ACCOUNTANT cannot create";
  - "ownership › rep cannot create from another rep's reservation → NOT_FOUND";
  - "tenant isolation › create from B's reservation → NOT_FOUND";
  - "concurrency › two parallel creates: one wins, one CONTRACT_EXISTS";
  - "detail › draft schedule equals buildSchedule(terms, today) with estimated true".
- [ ] T012 [P] [US1] Shared schedule table: `src/shared/components/schedule-table/schedule-table.tsx`, `types.ts`, `index.ts`.
  - Plain props: lines `{ seq, dueDate, amount, paidAmount?, status? }`, `estimatedLabel?`, `statusLabels?`.
  - Seq 0 shows "الدفعة المقدمة". Money uses `formatRiyals`; dates use `formatRiyadhDate`.
  - Its own `overflow-x-auto` wrapper.
  - No feature imports.
- [ ] T013 [US1] Client create flow:
  - `src/features/contracts/client/contracts.queries.ts`: `contractListOptions`, `contractDetailOptions`, `contractOptionsOptions`, plus `createContract` / `updateContract` / `approveContract` fetchers;
  - `src/features/contracts/client/contract-labels.ts`: status labels and `ESTIMATED_DATES_LABEL = "التواريخ تقديرية، وتُثبَّت عند الاعتماد"`;
  - `src/features/contracts/client/contract-form/` (`contract-form.tsx`, `use-contract-form.ts`, `types.ts`, `index.ts`):
    - RHF + `zodResolver(contractTermsInputSchema)`, `MoneyInput` for the money fields;
    - min-price hint and a field error from `minFinalPrice`;
    - `useWatch` → `buildSchedule(values, today)` → `ScheduleTable` with the estimated label, only when the values parse;
    - submit disabled while pending; `applyApiError`; 409 shown in an `Alert` at the top;
    - on success: invalidate `contractKeys.all` and each `relatedQueryKeys`, toast, `router.push` to the detail page;
  - `src/features/contracts/client/new-contract-page/` (`new-contract-page.tsx`, `types.ts`, `index.ts`): `useQuery(contractOptionsOptions)` with loading and error states; expired → message + link to `/reservations`; `contractId` set → link to it; otherwise `ContractForm` in create mode;
  - `src/app/(app)/contracts/new/page.tsx`: `requireUser` → non-SALES `redirect("/contracts")` → `contractOptionsQuerySchema` (invalid → `notFound()`) → prefetch `contractKeys.options` → `HydrationBoundary` → `<NewContractPage relatedQueryKeys={[unitKeys.all, reservationKeys.all]} />`.
- [ ] T014 [US1] Contract page (read-only for now):
  - `src/features/contracts/client/contract-details/` (`contract-details.tsx`, `types.ts`, `index.ts`):
    - unit, client, rep, reservation expiry (`formatRiyadhDateTime`), unit price, final price, down payment, count, approval date, remaining;
    - `ScheduleTable` with the estimated label for a draft;
    - "تعديل" link for SALES when `salesRep.id === userId && status === "DRAFT" && !reservationExpired`;
    - loading, not-found and error states;
  - `src/app/(app)/contracts/[id]/page.tsx`: `requireUser` → `contractIdSchema` (invalid → `notFound()`) → prefetch `contractKeys.detail` → `<ContractDetails role userId relatedQueryKeys={[unitKeys.all, reservationKeys.all]} />`.
- [ ] T015 [US1] Reservations link (phase 4 files, minimal):
  - add `contractId: string | null` to `ReservationDto` in `src/features/reservations/reservations.types.ts`;
  - select `contract: { select: { id: true } }` in `findActiveReservations` in `src/features/reservations/server/reservations.repository.ts`;
  - map it in `src/features/reservations/server/reservations.service.ts`;
  - in `src/features/reservations/client/reservations-page/components/reservations-table/reservations-table.tsx`, for SALES show "إنشاء عقد" → `/contracts/new?reservationId=<id>` when `contractId` is null, else "عرض العقد" → `/contracts/<contractId>`;
  - add "list › contractId is set for a reservation with a draft" to `tests/integration/features/reservations/server/reservations.service.test.ts`.

**Checkpoint**: quickstart §2 passes by hand.

---

## Phase 4: User Story 2 — Accountant approves; contract, unit and schedule change together (P1)

**Goal**: one all-or-nothing approval: contract lock → unit lock → `clock_timestamp()` check → compare → approve → sold → installments → audit.

**Independent test**: quickstart §4. Forced-failure test leaves everything unchanged.

- [ ] T016 [US2] Write the approval tests first (they must fail) in `tests/integration/features/contracts/server/contracts.service.test.ts`:
  - "approve › success: approvedAt set, unit SOLD, lines stored, one CONTRACT_APPROVED audit row with unitPrice and finalPrice";
  - "approve › stored lines sum to finalPrice";
  - "approve › stored due dates equal buildSchedule(terms, startDate)";
  - "approve › down payment 0 stores no seq 0";
  - "approve › all-or-nothing: forced failure on the audit insert leaves draft, RESERVED unit, 0 installments, 0 audit rows":
    - temporary trigger `BEFORE INSERT ON audit_logs … WHEN (NEW.action = 'CONTRACT_APPROVED' AND NEW.entity_id = '<id>')` that raises;
    - dropped in `finally`, per research R13;
  - "approve › different finalPrice → CONTRACT_CHANGED, still a draft", and the same for downPayment and installmentCount;
  - "approve › expired reservation → RESERVATION_EXPIRED, unit not SOLD, no installments, no audit row";
  - "approve › approving twice → CONTRACT_ALREADY_APPROVED";
  - "approve › unit stays SOLD after the reservation's expiry passes" (move `expiresAt` into the past, call `listUnits`);
  - "concurrency › two parallel approvals: one wins, one set of installments, one audit row" (×10);
  - "role checks › MANAGER cannot approve", "role checks › SALES cannot approve";
  - "tenant isolation › accountant of B approving A's contract → NOT_FOUND, nothing changes".
- [ ] T017 [US2] Implement `approveContract(user, id, seen)` in `src/features/contracts/server/contracts.service.ts`, exactly per research R5 (approved 2026-11-13):
  1. ACCOUNTANT else `FORBIDDEN`.
  2. `withTransaction`:
     1. `lockContract` (none → `NOT_FOUND`);
     2. `approvedAt` set → `CONTRACT_ALREADY_APPROVED`;
     3. `lockUnit`;
     4. `now = dbClock(tx)`; `expiresAt <= now` or status ≠ RESERVED → `RESERVATION_EXPIRED`;
     5. compare the 3 values → `CONTRACT_CHANGED`;
     6. `markApproved(…, now)` (0 → `CONTRACT_ALREADY_APPROVED`);
     7. `markUnitSold` (0 → `RESERVATION_EXPIRED`, the second guard);
     8. `buildSchedule(terms, toRiyadhDate(now))` → `insertInstallments`;
     9. `insertAuditLog` with `meta { unitId, unitPrice, finalPrice, downPayment, installmentCount, startDate }` and `createdAt: now`.
  3. After the transaction commits, return `getContract(user, id)`. It is called outside the transaction, so it is not nested (the create and edit paths do the same).

  Rules: no service calls inside the transaction, and no `releaseExpired`.

  Also add `approveContractHandler` (body `contractTermsInputSchema`) in `contracts.routes.ts` and `src/app/api/contracts/[id]/approve/route.ts` exporting `POST`. T016 must pass.
- [ ] T018 [US2] Approve button:
  - `src/features/contracts/client/contract-details/components/approve-contract-button/` (`approve-contract-button.tsx`, `use-approve-contract-button.ts`, `types.ts`, `index.ts`):
    - confirm, then send the three shown values; spinner and disabled while pending;
    - 409 → `Alert` at the top; `CONTRACT_CHANGED` also invalidates the detail;
    - success → invalidate `contractKeys.all` + `relatedQueryKeys`, toast;
  - render it in `contract-details.tsx` for ACCOUNTANT when `status === "DRAFT" && !reservationExpired`.

**Checkpoint**: quickstart §4 and §5 pass by hand; the user's "approval is all-or-nothing" test is green.

---

## Phase 5: User Story 3 — Sales rep edits their draft (P2)

**Goal**: edit only while not approved and the reservation is active; an approved contract never changes.

**Independent test**: quickstart §3. A `PATCH` on an approved contract → 409, values unchanged.

- [ ] T019 [US3] Server edit path:
  - `updateContract(user, id, input)` per research R4 in `src/features/contracts/server/contracts.service.ts`: SALES → own contract else `NOT_FOUND` → approved → `CONTRACT_ALREADY_APPROVED` → expired → `RESERVATION_EXPIRED` → `minFinalPrice` → `updateDraftTerms` (0 → `CONTRACT_ALREADY_APPROVED`);
  - `updateContractHandler` (PATCH) in `contracts.routes.ts`, and add `PATCH` to `src/app/api/contracts/[id]/route.ts`.

  Tests in `contracts.service.test.ts`:
  - "edit › rep edits own draft";
  - "edit › approved contract → CONTRACT_ALREADY_APPROVED, values unchanged" (user "done when");
  - "edit › expired reservation → RESERVATION_EXPIRED, values unchanged";
  - "ownership › rep cannot edit another rep's draft → NOT_FOUND";
  - "role checks › MANAGER cannot edit", "role checks › ACCOUNTANT cannot edit";
  - "concurrency › edit vs approve never both succeed" (×10).
- [ ] T020 [US3] Edit page:
  - `src/features/contracts/client/edit-contract-page/` (`edit-contract-page.tsx`, `types.ts`, `index.ts`): `useQuery(contractDetailOptions)`; approved or expired → message and no form; else `ContractForm` in edit mode, prefilled;
  - `src/app/(app)/contracts/[id]/edit/page.tsx`: non-SALES → `redirect(`/contracts/${id}`)`; prefetch the detail; `<EditContractPage relatedQueryKeys={[reservationKeys.all]} />`.

---

## Phase 6: User Story 4 — Allowed users see contracts and schedules (P2)

**Goal**: the scoped list (drafts first) with remaining amounts and the expired marker; computed statuses on the detail page.

**Independent test**: quickstart §6; each role sees exactly what it should.

- [ ] T021 [US4] Server list path:
  - `listContracts(user, query)` in `src/features/contracts/server/contracts.service.ts`: SALES scoped; `sumPaidByContract` for approved ids; `reservationExpired`; `remaining`;
  - `listContractsHandler` in `contracts.routes.ts`, and add `GET` to `src/app/api/contracts/route.ts`.

  Tests in `contracts.service.test.ts`:
  - "list › accountant and manager see all reps' contracts";
  - "list › rep sees only own";
  - "list › item has unit, client, salesRep, finalPrice, remaining, status";
  - "list › draft with expired reservation has reservationExpired true";
  - "list › approved never has reservationExpired";
  - "list › drafts first, then newest approval, id breaks ties; pages never repeat or skip";
  - "list › remaining per row";
  - "detail › rep opening another rep's contract → NOT_FOUND";
  - "detail › has unit with price, client, salesRep, reservation expiresAt, terms, startDate, remaining, today";
  - "detail › approved schedule is the stored rows with estimated false";
  - "detail › statuses from paid amounts set in the DB";
  - "detail › remaining after setting paid amounts";
  - "tenant isolation › accountant/manager of A never list B's contracts";
  - "tenant isolation › detail, edit, approve of B's contract from A → NOT_FOUND".
- [ ] T022 [US4] Contracts list UI:
  - `src/features/contracts/client/contracts-page/` (`contracts-page.tsx`, `use-contracts-page.ts`, `index.ts`, and `components/contracts-table/` with `contracts-table.tsx`, `types.ts`, `index.ts`):
    - `useQuery` + `keepPreviousData`;
    - skeleton, empty "لا توجد عقود بعد", error with retry;
    - status badge مسودة / معتمد / انتهى الحجز;
    - `PaginationNav`;
  - `src/app/(app)/contracts/page.tsx` (prefetch `contractKeys.list`);
  - add `{ href: "/contracts", label: "العقود", roles: ROLES }` to `src/shared/lib/navigation.ts`, and "contracts item for MANAGER, SALES and ACCOUNTANT" to `tests/unit/shared/lib/navigation.test.ts`.

---

## Phase 7: Polish

- [ ] T023 HTTP-level tests in `tests/integration/features/contracts/server/contracts.routes.test.ts`:
  - "POST as accountant → 403";
  - "PATCH as manager → 403";
  - "PATCH on approved → 409";
  - "400 has fieldErrors.finalPrice / downPayment / installmentCount";
  - "409 body has code CONTRACT_CHANGED and the Arabic message";
  - "GET /api/contracts/{B id} as A → 404";
  - "route modules export only the documented methods" (`Object.keys` of each `route.ts`: `["GET","POST"]`, `["GET"]`, `["GET","PATCH"]`, `["POST"]`).
- [ ] T024 [P] Update `README.md`:
  - **Assumptions**: spec Assumptions and clarifications Q1–Q4.
  - **Technical decisions**:
    - R1 schedule and whole riyals;
    - **R5: the approval race and the fix** (contract → unit lock, `clock_timestamp()` after the lock, the conditional sold update as the second guard, one clock);
    - R8 date handling;
    - R9 triggers.
  - **Security**: tenant scope in every contracts query; the approval race.
  - **Not done**: delete/cancel, status filter, a DB check that the lines sum to the final price.
- [ ] T025 Final check:
  - `npm run lint && npm run typecheck && npm run test && npm run test:integration` all green;
  - walk quickstart §2–§7;
  - run `/security-review`;
  - `git diff AGENTS.md CLAUDE.md` is empty;
  - mark tasks done in this file.

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002–T010)** → stories.
  - Inside Foundational: T002 → T003. T004, T005 and T006 run in parallel with T002/T003. T007 needs T003 (`MAX_INSTALLMENTS`). T009 needs T005 and T008. T010 needs T003, T004, T007 and T009.
- **US1 (T011–T015)**: T011 → T013 → T014. T012 can go at any point after T004. T015 depends only on T001.
- **US2 (T016–T018)**: needs T011 (fixtures make drafts directly, but the create path proves the DTO shape) and T014 (the detail page for the button). T016 → T017 → T018.
- **US3 (T019–T020)**: needs T013 (`ContractForm`). T019's edit-vs-approve test needs T017.
- **US4 (T021–T022)**: needs T010 only. It can run in parallel with US2 and US3 on the server side.
- **Polish (T023–T025)**: after all stories.

## Parallel Example

```text
After T001:  T002 (domain tests) ‖ T004 (dates) ‖ T005 (migration) ‖ T006 (error codes)
After T010:  T011 (create server) ‖ T012 (schedule table) ‖ T015 (reservations link) ‖ T021 (list server)
```

## Implementation Strategy

1. **MVP = Foundational + US1 + US2**: draft, preview and approval. This covers every "done when" item:
   - the domain unit tests (T002);
   - all-or-nothing approval (T016–T017);
   - "approved cannot be edited", proven by the DB trigger in T005 and the service test in T019.

   If time runs out, do T019 (server edit + tests) before any remaining UI.
2. Then US3 (edit UI), then US4 (list UI), then polish.
3. If payments (phase 6) needs time, the first things to cut are the US4 list polish and the edit page UI. Record any cut in the README "Not done". **Never** cut T016–T017, T005 or T002.

# Implementation Plan: Contracts and Installment Schedule

**Branch**: `claude/contracts-installment-schedule-699d4a` (spec folder `006-contracts-installment-schedule`) | **Date**: 2026-11-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/006-contracts-installment-schedule/spec.md`

> **Blocked on phase 4.** This branch was cut from `main`, which has phases 1–3 but not phase 4 (`005-unit-reservations`, branch `claude/unit-reservations-16e517`, being implemented).
> - Implementation starts only after phase 4 is merged and this branch is rebased (constitution › Development Workflow).
> - What this phase uses from phase 4 is listed in [research R16](./research.md#r16-dependencies-on-phase-4).

## Summary

Add the `contracts` feature.

- **Schedule**: one pure function, `buildSchedule(terms, startDate)` in `features/contracts/domain/schedule.ts` (agreed).
  - It produces the down payment line (seq 0, only when > 0) and `n` monthly lines in whole riyals, with the remainder on the last line.
  - Line `i` is due on `addMonths(start, i)` in Asia/Riyadh.
  - The create/edit preview, the draft page and approval all call it.
- **Draft**: a sales rep creates a draft from their own active reservation and edits it while it is not approved.
  - The edit is a conditional `UPDATE … WHERE approvedAt IS NULL` (agreed).
  - Every value rule (95% floor, down payment < final price, 1–120 installments, ≥ 1 riyal per line) is enforced on the server, and repeated in the form for fast feedback.
- **Approval**: an accountant approves in one transaction.
  - Steps: lock the contract, lock the unit, check the reservation against the DB clock, compare the three values the accountant saw, set `approvedAt`, unit RESERVED → SOLD, insert installments, write the `CONTRACT_APPROVED` audit row.
  - This keeps every agreed step and adds the unit lock and the `clock_timestamp()` read to close a real race ([R5](./research.md#r5-approval-one-transaction-contract-lock-then-unit-lock-departure-adds-a-unit-lock); departure 1 below, approved).
- **Reads**: installment status (paid / overdue / partial / unpaid, overdue wins over partial) and the remaining amount are computed on read (agreed).
  - Managers and accountants see all company contracts; sales reps see their own.
  - "Today" comes from the DB clock in Riyadh, not the browser.
- **Schema**: one new migration ([R9](./research.md#r9-schema-change-one-new-migration)):
  - a `final_price` cap that mirrors the units price cap;
  - a trigger that makes an approved contract immutable;
  - a trigger that lets an installment change only its `paid_amount`.
  - **Why**: constitution V wants "approved contract cannot change" and "schedule cannot change" in the DB too, and the cap keeps money conversions exact.

## Technical Context

**Language/Version**: TypeScript (strict), Node 22 LTS

**Primary Dependencies**: as in phases 0–4: Next.js App Router (Route Handlers), React, TanStack Query, Zod, React Hook Form + `@hookform/resolvers`, Prisma + `@prisma/adapter-pg`, `date-fns` + `@date-fns/tz`, sonner, shadcn/`radix-ui`. **No new npm dependency** ([R15](./research.md#r15-dependencies)).

**Storage**: PostgreSQL 18.
- `contracts`: insert, update, lock.
- `installments`: insert, read.
- `units`: lock, status update.
- `reservations`, `clients`, `users`: read.
- `audit_logs`: insert.
- One new migration with raw SQL (one check, two triggers).

**Testing**: Vitest.
- Unit tests in `tests/unit` (no DB): domain, schemas, date helper, navigation.
- Integration tests in `tests/integration` on the real test database, rebuilt every run, files run one at a time.

**Target Platform**: Linux container (`docker compose up`); mobile and desktop browsers

**Project Type**: Web application (one Next.js project, feature folders)

**Performance Goals**:
- Approval is about 9 statements in one transaction and inserts at most 121 rows.
- List and detail pages answer well under 1 s with seed data.
- The list's remaining amounts use one grouped query per page, not one query per row.

**Constraints**:
- READ COMMITTED (default).
- One clock: the DB (`now()` for reads, `clock_timestamp()` after the locks in approval).
- `companyId` only from the session.
- Page size max 50.
- No Server Actions; logical RTL classes only.
- Money is integer halalas ≤ 1e11, so `number` is exact.

**Scale/Scope**:
- 1 new feature.
- 5 API handlers in 4 route files.
- 4 pages.
- 2 phase 4 files changed (DTO plus table link), 1 phase 3 file changed (units repository exports).
- About 8 new test files.

## Constitution Check

*Gate before research: PASS. Re-checked after design: PASS.*

| # | Principle | Status | Evidence / Notes |
|---|-----------|--------|------------------|
| I | Tenant Isolation | PASS | `companyId` and `userId` come only from `SessionUser`. Every new repository function takes `companyId` and filters by it, including the `FOR UPDATE` selects and `lockUnit` / `markUnitSold`. Phase 1's composite FK `(company_id, reservation_id)` refuses cross-company links. Another company's contract or reservation → 404 for every role. Proven by `svc` › "tenant isolation › …" and `routes` › "company B → 404". |
| II | Server-Side Authorization | PASS | Role in the service: create, edit and options are SALES; approve is ACCOUNTANT. Ownership: create, edit and options are scoped by `reservation.salesRepId = userId`; list and detail add the same scope for SALES. Input schemas are `.pick()` of the terms (+ `reservationId` on create), so `approvedAt`, `status`, `companyId` and `schedule` are stripped. Proven by "role checks", "ownership", "ignores hand-sent fields". |
| III | Financial Accuracy | PASS | Integer halalas in DB, code and JSON. `buildSchedule` sums exactly (unit tests over many combinations). Whole-riyal lines with the remainder last (agreed). Riyadh dates via `@date-fns/tz`; calendar dates kept as `YYYY-MM-DD` strings to avoid the `@db.Date` off-by-one ([R8](./research.md#r8-dates-riyadh-calendar-date--dbdate)). Status and remaining are computed on read. Unit tests cover 31 Jan, leap February, 100,000/3, down payment 0 and the sum. |
| IV | Atomic and Concurrency-Safe | PASS | Approval is one `withTransaction` (agreed), proven all-or-nothing with a real forced DB failure ([R13](./research.md#r13-proving-all-or-nothing-approval)). The contract `FOR UPDATE` serializes approvals and edits. The unit `FOR UPDATE` plus `clock_timestamp()` closes the release/re-reserve race. The unit moves only RESERVED → SOLD through a conditional update. Parallel tests ×10 ([R14](./research.md#r14-proving-concurrency)). |
| V | Database-Enforced Integrity | PASS | New migration: `final_price` cap, approved-contract immutability trigger, installment-terms immutability trigger. Existing: unique `reservation_id` (one contract per reservation), checks on down payment, count, amount and paid amount, composite FKs. Applied migrations are not edited. The 120 cap stays in code by the user's decision (clarification Q1). |
| VI | Layered Architecture | PASS | `route.ts` → `contracts.routes.ts` → `contracts.service.ts` → `contracts.repository.ts`. Pure `domain/` (`schedule`, `pricing`, `installment-status`) has no DB or framework import. contracts → units through `units/server/index.ts` only (allowed direction). Nothing imports contracts. No client component imports another feature; related query keys come as props from `page.tsx` ([R12](./research.md#r12-cross-feature-imports)). No nested transactions. Strict TS, no `any`. |
| VII | Security by Default | PASS | Zod on bodies, query params and path ids. Raw SQL only as tagged templates. Generic Arabic errors; details only in the logger. One `CONTRACT_APPROVED` audit row per approval, with unit price and final price (clarification Q2). |
| VIII | Scope Discipline | PASS | No delete or cancel, no status filter, no payments (phase 6), no PDF or export. No new npm dependency. Assumptions go to the README. |

## Departures and clarifications

All eight agreed decisions are kept. These points add to or refine them:

1. **Approval also locks the unit row and checks expiry with `clock_timestamp()`** ([R5](./research.md#r5-approval-one-transaction-contract-lock-then-unit-lock-departure-adds-a-unit-lock)). **Approved by the user on 2026-11-13.** The README "Technical decisions" explains the race and the fix.
   - Agreed step "check the reservation is still active" becomes:
     - `lockUnit` (`SELECT … FOR UPDATE`) right after the contract lock;
     - then `expiresAt > clock_timestamp()`.
   - The conditional RESERVED → SOLD update stays as the second guard.
   - **Why**: with only the contract lock and the transaction-start `now()`, an approval that starts just before expiry can sell a unit that was meanwhile released and re-reserved by another rep. The conditional update cannot tell whose reservation set RESERVED.
   - **Lock order**: contract, then unit. No other path locks a unit and then a contract. Approval does not call `releaseExpired`.
   - `approvedAt`, the start date and the audit `createdAt` all use that one clock read.
2. **Minimum price** stays `Math.ceil(unitPrice * 95 / 100)` exactly as agreed. For integer prices ≤ 1e11 this is exact (R2), and a unit test checks it against a BigInt reference.
3. **Two 409 codes besides the agreed ones**:
   - `CONTRACT_EXISTS`: a second contract for a reservation (FR-003). It maps the unique-violation on either `contracts_reservation_id_key` or `contracts_company_id_reservation_id_key`.
   - `RESERVATION_EXPIRED`: create, edit or approve on an expired reservation (FR-002, FR-017, FR-020).
4. **Schema change** (the user asked to say why):
   - one migration, `contracts_guards` (R9): `final_price <= 1e11`, `contracts_approved_immutable`, `installments_terms_immutable`;
   - no new table or column.
5. **Phase 3 and phase 4 files touched**, kept minimal:
   - units repository: two exports;
   - `ReservationDto.contractId`;
   - the reservations table link;
   - `dates.ts`: two helpers.

## Project Structure

### Documentation (this feature)

```text
specs/006-contracts-installment-schedule/
├── spec.md
├── plan.md                # this file
├── research.md            # R1–R16
├── data-model.md
├── quickstart.md
├── contracts/
│   └── contracts-api.md
├── checklists/requirements.md
└── tasks.md               # /speckit-tasks (not created here)
```

### Source Code: every file created or changed

Legend:
- **new**, **change**.
- **P3** = a phase 3 file (on `main`).
- **P4** = a phase 4 file (path as on branch `claude/unit-reservations-16e517`, checked after the rebase).
- `<timestamp>` is set by `prisma migrate dev --create-only`.

```text
# Database
prisma/migrations/<timestamp>_contracts_guards/migration.sql   new  contracts_final_price_max_check; contracts_approved_immutable trigger (BEFORE UPDATE OR DELETE, OLD.approved_at IS NOT NULL → raise); installments_terms_immutable trigger (BEFORE UPDATE: contract_id/seq/due_date/amount changed → raise; BEFORE DELETE → raise)
prisma/schema.prisma                                           unchanged (checks and triggers are raw SQL)

# Server infrastructure
src/server/http/error-codes.ts            change  + CONTRACT_EXISTS, CONTRACT_ALREADY_APPROVED, CONTRACT_CHANGED, RESERVATION_EXPIRED: 409

# Shared
src/shared/lib/error-messages.ts          change  + 4 Arabic messages (research R10)
src/shared/lib/dates.ts                   P4 change  + toRiyadhDate(instant: Date): "YYYY-MM-DD"; + formatRiyadhDate("YYYY-MM-DD"): "yyyy/MM/dd" for display
src/shared/lib/navigation.ts              change  + { href: "/contracts", label: "العقود", roles: ROLES }

# Units feature (phase 3 files, extended in phase 4)
src/features/units/server/units.repository.ts   P3/P4 change  + lockUnit(companyId, unitId, tx) (SELECT status … FOR UPDATE); + markUnitSold(companyId, unitId, tx) (updateMany WHERE status = 'RESERVED' → SOLD; returns count)
src/features/units/server/index.ts              P3/P4 change  + export lockUnit, markUnitSold

# Reservations feature (phase 4 files)
src/features/reservations/reservations.types.ts                         P4 change  ReservationDto + contractId: string | null
src/features/reservations/server/reservations.repository.ts             P4 change  findActiveReservations selects contract { id }
src/features/reservations/server/reservations.service.ts                P4 change  DTO mapper sets contractId
src/features/reservations/client/reservations-page/components/reservations-table/reservations-table.tsx  P4 change  SALES: "إنشاء عقد" → /contracts/new?reservationId=<id> when contractId is null, else "عرض العقد" → /contracts/<contractId>

# Contracts feature (new)
src/features/contracts/contracts.schemas.ts         new  contractSchema (id, reservationId, finalPrice, downPayment, installmentCount); contractTermsRefine; contractTermsInputSchema (.pick terms); createContractInputSchema (.pick reservationId + terms); contractIdSchema; contractListQuerySchema (paginationFields); contractOptionsQuerySchema (.pick reservationId)
src/features/contracts/contracts.types.ts           new  ContractStatus, InstallmentStatus, ScheduleLineDto, ContractListItemDto, ContractDetailDto, ContractOptionsDto, ContractPage, input/query types
src/features/contracts/contracts.keys.ts            new  contractKeys.all / list(query) / detail(id) / options(reservationId)
src/features/contracts/domain/schedule.ts           new  MAX_INSTALLMENTS = 120; ScheduleTerms; ScheduleLine; buildSchedule(terms, startDate); scheduleTotal(lines)
src/features/contracts/domain/pricing.ts            new  minFinalPrice(unitPrice) = Math.ceil(unitPrice * 95 / 100)
src/features/contracts/domain/installment-status.ts new  installmentStatus(line, today); contractRemaining(finalPrice, lines)
src/features/contracts/server/contracts.repository.ts  new  dbNow(tx?); dbClock(tx) (clock_timestamp()); findOwnReservation(companyId, salesRepId, reservationId, tx?); insertContract(companyId, input, tx); findContract(companyId, id, { salesRepId? }, tx?) (with reservation, unit, client, rep, installments); findContracts / countContracts(companyId, { salesRepId?, skip, take }, tx?); sumPaidByContract(companyId, contractIds, tx?); updateDraftTerms(companyId, id, terms, tx) (updateMany WHERE approvedAt null → count); lockContract(companyId, id, tx) ($queryRaw … FOR UPDATE with reservation expires_at, unit_id, unit price); markApproved(companyId, id, at, tx) (→ count); insertInstallments(companyId, contractId, lines, tx) (first `contract.count({ id, companyId }) === 1` else NOT_FOUND, then createMany; installments have no company_id column). dbNow/dbClock read only the DB time, not tenant data, so they take no companyId
src/features/contracts/server/contracts.service.ts     new  listContracts, getContract, getContractOptions, createContract, updateContract, approveContract (+ toListItemDto, toDetailDto)
src/features/contracts/server/contracts.routes.ts      new  listContractsHandler (GET), createContractHandler (POST), getContractHandler (GET), updateContractHandler (PATCH), approveContractHandler (POST), contractOptionsHandler (GET)
src/features/contracts/server/index.ts                 new  public API: route handlers; listContracts, getContract, getContractOptions (for page prefetch)
src/features/contracts/client/contracts.queries.ts     new  contractListOptions(query), contractDetailOptions(id), contractOptionsOptions(reservationId) via queryOptions(); createContract, updateContract, approveContract fetchers
src/features/contracts/client/contract-labels.ts       new  CONTRACT_STATUS_LABELS, INSTALLMENT_STATUS_LABELS, ESTIMATED_DATES_LABEL = "التواريخ تقديرية، وتُثبَّت عند الاعتماد"
src/features/contracts/client/contracts-page/contracts-page.tsx       new  useQuery(keepPreviousData); loading / empty / error; PaginationNav
src/features/contracts/client/contracts-page/use-contracts-page.ts    new  URL ⇄ page
src/features/contracts/client/contracts-page/index.ts                 new
src/features/contracts/client/contracts-page/components/contracts-table/contracts-table.tsx  new  unit, client, rep, final price, remaining, status badge (مسودة / معتمد / انتهى الحجز), link to detail
src/features/contracts/client/contracts-page/components/contracts-table/types.ts            new
src/features/contracts/client/contracts-page/components/contracts-table/index.ts            new
src/features/contracts/client/contract-form/contract-form.tsx         new  RHF form (finalPrice, downPayment via MoneyInput; installmentCount); min-price hint; preview; 409 at top; submit disabled while pending
src/features/contracts/client/contract-form/use-contract-form.ts      new  zodResolver(contractTermsInputSchema); minFinalPrice check; useWatch → buildSchedule(values, today); useMutation create/update; applyApiError; invalidate contractKeys.all + relatedQueryKeys; toast; router.push to detail
src/features/contracts/client/contract-form/types.ts                  new  ContractFormProps { mode: "create" | "edit"; reservationId?; contractId?; unitPrice; minFinalPrice; today; defaultValues?; relatedQueryKeys }
src/features/contracts/client/contract-form/index.ts                  new
src/features/contracts/client/new-contract-page/new-contract-page.tsx      new  useQuery(contractOptionsOptions); loading / error / expired / contract-exists; renders ContractForm (create)
src/features/contracts/client/new-contract-page/types.ts                   new
src/features/contracts/client/new-contract-page/index.ts                   new
src/features/contracts/client/contract-details/contract-details.tsx        new  useQuery(contractDetailOptions); unit/client/rep/reservation expiry/prices/count/approval date/remaining; ScheduleTable; edit link (owning SALES, active draft); ApproveContractButton (ACCOUNTANT, active draft); loading / not-found / error
src/features/contracts/client/contract-details/types.ts                    new
src/features/contracts/client/contract-details/index.ts                    new
src/features/contracts/client/contract-details/components/approve-contract-button/approve-contract-button.tsx  new  confirm + submit; spinner; 409 message at the top
src/features/contracts/client/contract-details/components/approve-contract-button/use-approve-contract-button.ts new  useMutation(approve with the shown values); on success invalidate contractKeys.all + relatedQueryKeys, toast; on CONTRACT_CHANGED invalidate detail
src/features/contracts/client/contract-details/components/approve-contract-button/types.ts  new
src/features/contracts/client/contract-details/components/approve-contract-button/index.ts  new
src/features/contracts/client/edit-contract-page/edit-contract-page.tsx    new  useQuery(contractDetailOptions); approved / expired → message; else ContractForm (edit, prefilled)
src/features/contracts/client/edit-contract-page/types.ts                  new
src/features/contracts/client/edit-contract-page/index.ts                  new
src/shared/components/schedule-table/schedule-table.tsx   new  seq ("الدفعة المقدمة" for 0), due date, amount, optional paid amount + status badge; estimated label; overflow-x-auto on its own wrapper
src/shared/components/schedule-table/types.ts             new  ScheduleTableProps (plain line shape; no feature import)
src/shared/components/schedule-table/index.ts             new
  (shared because the contract form preview and the contract details both render it, and phase 6's payment view will too; it takes plain props and imports no feature.)

# Routing
src/app/(app)/contracts/page.tsx               new  requireUser → contractListQuerySchema → prefetch contractKeys.list → <ContractsPage>
src/app/(app)/contracts/new/page.tsx           new  requireUser → non-SALES → redirect("/contracts") → contractOptionsQuerySchema (invalid → notFound()) → prefetch contractKeys.options → <NewContractPage relatedQueryKeys={[unitKeys.all, reservationKeys.all]}>
src/app/(app)/contracts/[id]/page.tsx          new  requireUser → contractIdSchema (invalid → notFound()) → prefetch contractKeys.detail → <ContractDetails role userId relatedQueryKeys={[unitKeys.all, reservationKeys.all]}>
src/app/(app)/contracts/[id]/edit/page.tsx     new  requireUser → non-SALES → redirect(`/contracts/${id}`) → prefetch detail → <EditContractPage relatedQueryKeys={[reservationKeys.all]}>
src/app/api/contracts/route.ts                 new  export { listContractsHandler as GET, createContractHandler as POST }
src/app/api/contracts/options/route.ts         new  export { contractOptionsHandler as GET }
src/app/api/contracts/[id]/route.ts            new  export { getContractHandler as GET, updateContractHandler as PATCH }
src/app/api/contracts/[id]/approve/route.ts    new  export { approveContractHandler as POST }

# Tests
tests/unit/features/contracts/domain/schedule.test.ts            new
tests/unit/features/contracts/domain/pricing.test.ts             new
tests/unit/features/contracts/domain/installment-status.test.ts  new
tests/unit/features/contracts/contracts.schemas.test.ts          new
tests/unit/shared/lib/dates.test.ts                              P4 change  + toRiyadhDate, formatRiyadhDate
tests/unit/shared/lib/navigation.test.ts                         change  + contracts item for all roles
tests/integration/support/db-fixtures.ts                         unchanged  (makeReservation, makeContract, makeInstallment already exist from phase 1)
tests/integration/prisma/contracts-guards.test.ts                new
tests/integration/features/contracts/server/contracts.repository.test.ts  new
tests/integration/features/contracts/server/contracts.service.test.ts     new
tests/integration/features/contracts/server/contracts.routes.test.ts      new
tests/integration/features/reservations/server/reservations.service.test.ts  P4 change  + "list › contractId is set for a reservation with a draft"

# Docs
README.md        change  Assumptions (spec Assumptions + clarifications Q1–Q4), Technical decisions (R1 schedule, R5 approval locks + one clock, R8 dates, R9 triggers), Security (approval race, tenant scope), Not done (delete/cancel, status filter, sum check in DB)
```

**Structure Decision**: the AGENTS.md feature layout.
- `src/features/contracts` holds `contracts.schemas.ts`, `contracts.types.ts`, `contracts.keys.ts`, `domain/` (pure), `server/` (routes → service → repository, plus `index.ts`) and `client/` (one folder per component, private children under `components/`).
- `ScheduleTable` goes to `src/shared/components/` because two contracts components and phase 6 use it, and it takes only plain props.
- Tests mirror `src/`.

### Service flows (the only places with business rules)

`dbNow()` = `SELECT now()`; `today = toRiyadhDate(dbNow)`.

- **`listContracts(user, query)`**:
  - SALES → `salesRepId = userId`.
  - Then find + count, `sumPaidByContract` for approved ids, `now = dbNow()` → items with `status`, `reservationExpired = draft && expiresAt <= now`, and `remaining`.
- **`getContract(user, id)`**:
  - `findContract(companyId, id, { salesRepId: SALES ? userId : undefined })`; none → `NOT_FOUND`.
  - `now = dbNow()`, `today`.
  - Draft → `buildSchedule(terms, today)`, `estimated: true`.
  - Approved → stored lines + `installmentStatus(line, today)`, `remaining`.
- **`getContractOptions(user, reservationId)`**: not SALES → `FORBIDDEN`. `findOwnReservation`; none → `NOT_FOUND`. Return the DTO with `minFinalPrice(unit.price)`, `today` and `contractId`.
- **`createContract(user, input)`**: [R3](./research.md#r3-creating-a-draft).
- **`updateContract(user, id, input)`**: [R4](./research.md#r4-editing-a-draft).
- **`approveContract(user, id, seen)`**: [R5](./research.md#r5-approval-one-transaction-contract-lock-then-unit-lock-departure-adds-a-unit-lock).

**Transaction rules**:
- No service calls another service inside `withTransaction`.
- Lock order: contract → unit.
- `releaseExpired` is never called in this feature.

Route handlers only parse (body: `readJson` + schema; path: `contractIdSchema.safeParse` → 404; query: `toQueryInput` + schema), call the service and return `{ data }` (201 for create).

### UI states (FR-032 – FR-037)

- **Lists and pages**:
  - `isPending` → skeleton;
  - placeholder data → dimmed table;
  - empty → `EmptyState`;
  - `isError` → `ErrorState` with retry;
  - 404 → `NotFoundMessage`.
- **Form**: the preview is shown only when the three values pass the schema. The min-price hint is under the field. Submit is disabled while pending. 400 → field errors; 409 → `Alert` at the top.
- **Approve**: the button is shown only for ACCOUNTANT with `status === "DRAFT" && !reservationExpired`. It is disabled while pending. 409 → `Alert` at the top; `CONTRACT_CHANGED` refetches the detail.
- **Edit link**: shown only for SALES when `salesRep.id === userId && status === "DRAFT" && !reservationExpired`.
- **Navigation**: "العقود" for all roles.

## Requirement → proof map

"Auto" = an automated test. "Manual" = a step in [quickstart.md](./quickstart.md). Test names are the `it(...)` titles to use.

Short names:
- `sched` = `tests/unit/features/contracts/domain/schedule.test.ts`
- `price` = `tests/unit/features/contracts/domain/pricing.test.ts`
- `status` = `tests/unit/features/contracts/domain/installment-status.test.ts`
- `schemas` = `tests/unit/features/contracts/contracts.schemas.test.ts`
- `dates` = `tests/unit/shared/lib/dates.test.ts`
- `svc` = `tests/integration/features/contracts/server/contracts.service.test.ts`
- `routes` = `tests/integration/features/contracts/server/contracts.routes.test.ts`
- `repo` = `tests/integration/features/contracts/server/contracts.repository.test.ts`
- `guards` = `tests/integration/prisma/contracts-guards.test.ts`

| Rule | Proof | Kind |
|---|---|---|
| FR-001 only SALES create, own reservation | `svc` › "role checks › MANAGER cannot create", "role checks › ACCOUNTANT cannot create", "ownership › rep cannot create from another rep's reservation → NOT_FOUND"; `routes` › "POST as accountant → 403" | Auto |
| FR-002 create only from an active reservation | `svc` › "create › expired reservation → RESERVATION_EXPIRED, no contract" | Auto |
| FR-003 one contract per reservation, also in parallel | `svc` › "create › second contract for the same reservation → CONTRACT_EXISTS", "concurrency › two parallel creates: one wins, one CONTRACT_EXISTS"; `guards` (phase 1 `schema-constraints.test.ts` already proves the unique) | Auto |
| FR-004 server-set fields ignored | `schemas` › "create input strips approvedAt, companyId, status, schedule, salesRepId"; `svc` › "create › ignores hand-sent approvedAt and status" | Auto |
| FR-005 new contract is a draft, unit stays reserved | `svc` › "create › rep creates a draft: approvedAt null, no installments, unit RESERVED" | Auto |
| FR-006 final price ≥ ceil(95%) | `price` › "475,000 for 500,000", "rounds 95% up to the next halala (unit price 1 → 1)", "matches a BigInt ceiling for 10,000 sampled prices up to 1e11"; `svc` › "create › final price one halala below the minimum → VALIDATION_ERROR on finalPrice naming the minimum", "create › final price equal to the minimum is accepted", "create › final price above the unit price is accepted" (Q2) | Auto |
| FR-007 0 ≤ down payment < final price | `schemas` › "downPayment equal to finalPrice → error on downPayment", "negative downPayment → error"; `guards`-level check exists from phase 1 | Auto |
| FR-008 1 … 120 installments | `schemas` › "installmentCount 0, 121 and 1.5 → error", "1 and 120 accepted" | Auto |
| FR-009 ≥ 1 riyal per line | `schemas` › "2 riyals over 3 installments → error on installmentCount", "3 riyals over 3 accepted"; `sched` › "every line is at least 100 halalas for valid terms" | Auto |
| FR-010 riyals in UI, halalas everywhere | `tests/unit/shared/lib/money.test.ts` (P3, reused); `sched` › "sum equals finalPrice for every combination" (halala inputs) | Auto |
| FR-011 errors next to fields, same rules on server | `routes` › "400 has fieldErrors.finalPrice / downPayment / installmentCount"; the form uses the same `contractTermsInputSchema`; quickstart §2 | Auto + Manual |
| FR-012 schedule rule | `sched` › "100,000 over 3 → 33,333 / 33,333 / 33,334" (user "done when"), "31 January start → 28 Feb, 31 Mar, 30 Apr" (user "done when"), "31 January 2028 → 29 February 2028" (leap year, user "done when"), "29 February 2028 + 12 → 28 February 2029", "each date counts from the start, not the previous line", "down payment is line 0 due on the start date", "remainder with halalas goes to the last line" | Auto |
| FR-013 sum = final price exactly | `sched` › "sum equals finalPrice for every combination" (loop: finalPrice and downPayment with and without halalas × installmentCount 1…120; user "done when"); `svc` › "approve › stored lines sum to finalPrice" | Auto |
| FR-014 down payment 0 → no line 0 | `sched` › "down payment 0 → no seq 0, first line one month after start" (user "done when"); `svc` › "approve › down payment 0 stores no seq 0" | Auto |
| FR-015 preview = same rule from today; estimated label; stored dates after approval | `svc` › "detail › draft schedule equals buildSchedule(terms, today) with estimated true", "detail › approved schedule is the stored rows with estimated false"; `svc` › "approve › stored due dates equal buildSchedule(terms, startDate)" (R8 round-trip); quickstart §2 (label text) | Auto + Manual |
| FR-016 only the owning rep edits; 403/404 | `svc` › "role checks › MANAGER cannot edit", "role checks › ACCOUNTANT cannot edit", "ownership › rep cannot edit another rep's draft → NOT_FOUND", "edit › rep edits own draft"; `routes` › "PATCH as manager → 403" | Auto |
| FR-017 draft of expired reservation not editable | `svc` › "edit › expired reservation → RESERVATION_EXPIRED, values unchanged" | Auto |
| FR-018 approved contract never changes (user "done when") | `svc` › "edit › approved contract → CONTRACT_ALREADY_APPROVED, values unchanged", "concurrency › edit vs approve never both succeed" (×10); `routes` › "PATCH on approved → 409"; `guards` › "UPDATE of an approved contract fails", "DELETE of an approved contract fails", "UPDATE of a draft succeeds" | Auto |
| FR-019 only ACCOUNTANT approves; other company 404 | `svc` › "role checks › MANAGER cannot approve", "role checks › SALES cannot approve", "tenant isolation › accountant of B approving A's contract → NOT_FOUND, nothing changes" | Auto |
| FR-020 approval refused when the reservation expired | `svc` › "approve › expired reservation → RESERVATION_EXPIRED, unit not SOLD, no installments, no audit row" | Auto |
| FR-021 values changed → CONTRACT_CHANGED | `svc` › "approve › different finalPrice → CONTRACT_CHANGED, still a draft", "… downPayment …", "… installmentCount …"; `routes` › "409 body has code CONTRACT_CHANGED and the Arabic message"; quickstart §4 (view refresh) | Auto + Manual |
| FR-022 already approved → 409; parallel approvals → one | `svc` › "approve › approving twice → CONTRACT_ALREADY_APPROVED", "concurrency › two parallel approvals: one wins, one set of installments, one audit row" (×10) | Auto |
| FR-023 all-or-nothing approval with audit (user "done when") | `svc` › "approve › success: approvedAt set, unit SOLD, lines stored, one CONTRACT_APPROVED audit row with unitPrice and finalPrice"; `svc` › "approve › all-or-nothing: forced failure on the audit insert leaves draft, RESERVED unit, 0 installments, 0 audit rows" ([R13](./research.md#r13-proving-all-or-nothing-approval)) | Auto |
| FR-024 sold unit stays sold | `svc` › "approve › unit stays SOLD after the reservation's expiry passes" (move `expiresAt` into the past, call `listUnits`, unit SOLD) | Auto |
| FR-025 visibility by role | `svc` › "list › accountant and manager see all reps' contracts", "list › rep sees only own", "detail › rep opening another rep's contract → NOT_FOUND" | Auto |
| FR-026 list fields; expired marker | `svc` › "list › item has unit, client, salesRep, finalPrice, remaining, status", "list › draft with expired reservation has reservationExpired true", "list › approved never has reservationExpired" | Auto |
| FR-027 paging, order, no filter, 400 | `svc` › "list › drafts first, then newest approval, id breaks ties; pages never repeat or skip"; `schemas` › "pageSize 51 → error", "defaults 1 / 20", "unknown status key is stripped" | Auto |
| FR-028 detail fields | `svc` › "detail › has unit with price, client, salesRep, reservation expiresAt, terms, startDate, remaining, today" | Auto |
| FR-029 status computed, rules | `status` › "paid when paidAmount equals amount, even past due", "overdue when unpaid and due before today", "overdue wins over partial", "partial when part paid and due today or later", "unpaid when nothing paid and due today (not overdue)", "down payment due on the approval date is overdue the next day"; `svc` › "detail › statuses from paid amounts set in the DB" | Auto |
| FR-030 remaining = final − Σ paid | `status` › "contractRemaining subtracts all paid amounts"; `svc` › "detail › remaining after setting paid amounts", "list › remaining per row" | Auto |
| FR-031 / SC-006 no other company anywhere | `svc` › "tenant isolation › accountant/manager of A never list B's contracts", "tenant isolation › detail, edit, approve of B's contract from A → NOT_FOUND", "tenant isolation › create from B's reservation → NOT_FOUND"; `routes` › "GET /api/contracts/{B id} as A → 404"; `repo` › "every query filters by companyId" | Auto |
| FR-032 create action on own active reservations without a contract | `reservations.service.test.ts` (P4) › "list › contractId is set for a reservation with a draft"; quickstart §2 | Auto + Manual |
| FR-033 edit / approve shown only when allowed | quickstart §3, §4, §5, §6 | Manual |
| FR-034 loading, no double submit, 409 at top | quickstart §4; `tests/unit/shared/lib/form-errors.test.ts` (P3) › "maps 409 to root" (reused) | Manual + Auto |
| FR-035 lists refresh without reload | quickstart §2, §4 (invalidation of contracts, units, reservations) | Manual |
| FR-036 nav for all roles | `tests/unit/shared/lib/navigation.test.ts` › "contracts item for MANAGER, SALES and ACCOUNTANT" | Auto |
| FR-037 Arabic RTL, Riyadh dates, mobile | `dates` › "toRiyadhDate(2027-01-30T22:00Z) is 2027-01-31" (Story 2 scenario 5), "formatRiyadhDate"; quickstart §7 | Auto + Manual |
| FR-038 unit tests list (user "done when") | `sched` rows above: 31 January, leap February, 100,000 over 3, down payment 0, sum loop | Auto |
| FR-039 status unit tests | `status` rows above | Auto |
| FR-040 integration list (user "done when") | `svc` and `routes` rows above; `guards` | Auto |
| R5 lock order / no deadlock | `svc` › "concurrency › edit vs approve" and "two parallel approvals" finish within the test timeout (×10); design note in README | Auto |
| R9 schedule immutable | `guards` › "UPDATE installments SET amount fails", "UPDATE installments SET paid_amount succeeds", "DELETE installment fails", "final_price above 1e11 fails (23514)" | Auto |
| No delete or cancel | `routes` › "route modules export only the documented methods" (`Object.keys` of each `route.ts`) | Auto |

## Complexity Tracking

No constitution violations, so nothing to justify.
- Departure 1 (the unit lock in approval) adds to an agreed decision and was approved by the user on 2026-11-13. It is not a constitution exception.

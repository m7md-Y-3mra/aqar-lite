# Research: Contracts and Installment Schedule

Each decision lists what was chosen, why, and what was rejected.
- "Phase 3" means `specs/004-unit-client-management` (merged into `main`).
- "Phase 4" means `specs/005-unit-reservations` (branch `claude/unit-reservations-16e517`, being implemented, not merged yet).
- "Agreed" means the decisions the user gave with `/speckit-plan` (also in `docs/phases.md` › Phase 5 › Plan notes).

## R1. The schedule: one pure function

**Decision**: `buildSchedule(terms, startDate)` in `src/features/contracts/domain/schedule.ts` (agreed).
- Input: `{ finalPrice, downPayment, installmentCount }` in integer halalas, and `startDate` as a `YYYY-MM-DD` string (a calendar date in Saudi time).
- Output: `ScheduleLine[]`, where each line is `{ seq, dueDate: "YYYY-MM-DD", amount }`.
- Rules:
  1. If `downPayment > 0`, line `seq 0` = `{ amount: downPayment, dueDate: startDate }`. If it is 0, there is no line 0 (agreed).
  2. `rest = finalPrice − downPayment`.
     - `base = Math.floor(rest / (installmentCount * 100)) * 100`, which is whole riyals in halalas.
     - Lines `1 … n−1` get `base`. Line `n` gets `rest − base × (n − 1)`, the remainder including any halalas (agreed).
  3. Line `i` (from 1) is due on `addMonths(start, i)`, counted from `start` each time, never from the previous line (agreed).
     - `start` is `new TZDate(y, m − 1, d, "Asia/Riyadh")` and the result is formatted with `yyyy-MM-dd`.
     - When the day does not exist, `date-fns` `addMonths` moves it to the last day of the month (31 Jan + 1 → 28/29 Feb).
- The same function feeds the create/edit preview (client), the draft page (server), and the stored schedule on approval (server). The preview and the stored rows therefore cannot drift apart (clarification Q3).
- All math uses JS `number` on integers. The values are capped at 1e11 halalas (R9), so they stay far below 2^53 and every operation is exact.

**Rationale**: a pure function with plain-string dates can be unit tested with no DB, no clock and no time zone set on the machine.

**Alternatives considered**:
- Dividing in riyals with decimals and rounding each line. Rejected: halalas can be lost or gained.
- Spreading the remainder over the first lines (+1 riyal each). Rejected: the agreed rule puts the remainder on the last line.
- Counting each date from the previous due date. Rejected by the brief's 31 January example: 31 Jan → 28 Feb → 28 Mar is wrong.

## R2. Contract value rules and where they run

**Decision**:

| Rule | Where (server) | Where (form) |
|---|---|---|
| final price integer 1 … 1e11 halalas | `contractSchema` (Zod) | same schema (zodResolver) |
| down payment integer 0 … 1e11, and `< finalPrice` | schema + `.superRefine` (`contractTermsRefine`) | same |
| installment count integer 1 … `MAX_INSTALLMENTS` (120) | schema | same |
| `finalPrice − downPayment ≥ installmentCount × 100` (every line ≥ 1 riyal, FR-009) | `contractTermsRefine` | same |
| `finalPrice ≥ minFinalPrice(unitPrice)` | service (needs the unit price from the DB) | form, via `minFinalPrice` from domain with the unit price from the options/detail DTO |

- `MAX_INSTALLMENTS = 120` is one constant in `src/features/contracts/domain/schedule.ts` (clarification Q1).
- `minFinalPrice(unitPrice) = Math.ceil(unitPrice * 95 / 100)` (agreed), in `src/features/contracts/domain/pricing.ts`.
  - For integer `unitPrice ≤ 1e11`, `unitPrice * 95` is exact (< 2^53). The division is correctly rounded with an error far below 1/100.
  - So `Math.ceil` gives the exact integer ceiling. A unit test compares it with a BigInt reference.
- The service returns `VALIDATION_ERROR` with `fieldErrors.finalPrice = ["أقل سعر مسموح هو <formatRiyals(min)> ريال"]` (FR-006).
- **No upper limit relative to the unit price** (clarification Q2). The only cap is the global 1e11.

**Rationale**:
- One schema serves the API and the form (AGENTS §B "Validation and Forms").
- The unit-price rule needs DB data, so the service is the authority. The form repeats it only for fast feedback.

**Alternatives considered**: a Zod schema built per request with the unit price inside it. Rejected: the form and the API would then use different schema objects, and the rule is easier to test as a domain function.

## R3. Creating a draft

**Decision**: `createContract(user, input)` in `contracts.service.ts`:

1. `user.role !== "SALES"` → `FORBIDDEN` (403).
2. `withTransaction(async (tx) => …)`:
   1. `findOwnReservation(companyId, salesRepId = userId, reservationId, tx)` from the contracts repository.
      - It reads the reservation with its unit price and contract id.
      - Another rep's reservation, another company's, or a missing one → `NOT_FOUND`.
   2. Reservation already has a contract → `CONTRACT_EXISTS` (409).
   3. `expiresAt <= dbNow(tx)` → `RESERVATION_EXPIRED` (409).
   4. `finalPrice < minFinalPrice(unit.price)` → `VALIDATION_ERROR` with `fieldErrors.finalPrice`.
   5. `insertContract(companyId, input, tx)`.
      - A unique violation on `contracts_reservation_id_key` **or** `contracts_company_id_reservation_id_key` → `CONTRACT_EXISTS`. Two parallel creates both pass step 2, and the DB stops the second one.
3. Return the contract detail DTO (R7).

The reservations table lives in the reservations feature, but a repository may read any table through Prisma. Phase 4 R6 did the same for units. The contracts feature still imports nothing it is not allowed to.

**Why no unit lock or `releaseExpired` here**:
- A draft does not change the unit.
- If the reservation expires right after the check, the draft is harmless: it cannot be edited (R4) or approved (R5).

## R4. Editing a draft

**Decision**: `updateContract(user, id, input)`:

1. `user.role !== "SALES"` → `FORBIDDEN`.
2. `withTransaction`:
   1. `findContractForRep(companyId, userId, id, tx)`: the contract must come from a reservation whose `salesRepId` is the user. Otherwise → `NOT_FOUND`.
   2. `approvedAt !== null` → `CONTRACT_ALREADY_APPROVED` (409). This is the fast answer; step 5 is the real guard.
   3. `reservation.expiresAt <= dbNow(tx)` → `RESERVATION_EXPIRED` (409), as clarified in the spec FR-017.
   4. `finalPrice < minFinalPrice(unit.price)` → `VALIDATION_ERROR`.
   5. `updateDraftTerms(companyId, id, input, tx)`: `updateMany({ where: { id, companyId, approvedAt: null }, data: … })`. 0 rows → `CONTRACT_ALREADY_APPROVED` (agreed).
3. Return the detail DTO.

**Race with approval** (spec Story 3 scenario 3):
- Approval holds the contract row lock (`FOR UPDATE`, R5). An edit's `UPDATE` waits for it.
- After approval commits, Postgres re-checks `approved_at IS NULL` on the new row version: 0 rows → 409.
- If the edit commits first, approval reads the new values after its lock and returns `CONTRACT_CHANGED`.
- The DB trigger in R9 is a third guard: any `UPDATE` of an approved contract row fails.

## R5. Approval: one transaction, contract lock then unit lock (departure: adds a unit lock)

**Status**: approved by the user on 2026-11-13 (contract → unit lock order; the conditional sold update stays as a second guard; the README explains the race and the fix).

**Agreed sequence**: lock the contract with `FOR UPDATE` → check the reservation is active → compare the 3 values → set `approvedAt` → unit RESERVED → SOLD (conditional) → insert installments → audit row, all in `withTransaction`.

**Problem with the agreed sequence as written**: it locks only the contract row and checks expiry with the transaction's start time. This interleaving is possible:
1. The approval transaction starts at T0, just before the reservation expires at E (T0 < E).
2. After E, a units-list read runs `releaseExpired` and frees the unit. Another rep reserves it and commits. The unit is `RESERVED` again, but now for a different reservation.
3. The approval reaches the unit update. `WHERE status = 'RESERVED'` matches, so the unit is sold under the other rep's reservation.

The approval's `now()` is T0, so its check "reservation active" still passes. The conditional update cannot tell whose reservation set `RESERVED`.

**Decision** (keeps every agreed step and adds one lock and one clock read):

`approveContract(user, id, seen)`:
1. `user.role !== "ACCOUNTANT"` → `FORBIDDEN`.
2. `withTransaction(async (tx) => …)`:
   1. `lockContract(companyId, id, tx)`: `SELECT … FROM contracts WHERE id = $id AND company_id = $companyId FOR UPDATE`, joined to its reservation (`unit_id`, `expires_at`) and the unit price. None → `NOT_FOUND`.
   2. `approvedAt !== null` → `CONTRACT_ALREADY_APPROVED`.
   3. `lockUnit(companyId, unitId, tx)` (new units export): `SELECT status FROM units WHERE id = $unitId AND company_id = $companyId FOR UPDATE`.
   4. `now = dbClock(tx)` → `SELECT clock_timestamp()`. This is read **after** the unit lock is held.
      - `reservation.expiresAt <= now` → `RESERVATION_EXPIRED`.
      - `status !== "RESERVED"` → `RESERVATION_EXPIRED`. This cannot happen while the reservation is active, but it is checked anyway.
   5. Compare `seen.finalPrice`, `seen.downPayment` and `seen.installmentCount` with the locked row. Any difference → `CONTRACT_CHANGED` (agreed).
   6. `markApproved(companyId, id, now, tx)`: `updateMany WHERE approvedAt IS NULL`. 0 rows → `CONTRACT_ALREADY_APPROVED`, which cannot happen under the lock.
   7. `markUnitSold(companyId, unitId, tx)` (new units export): conditional `RESERVED → SOLD` (agreed). 0 rows → `RESERVATION_EXPIRED`.
   8. `startDate = toRiyadhDate(now)`. Then `buildSchedule(terms, startDate)` → `insertInstallments(contractId, lines, tx)` with `createMany`.
   9. `insertAuditLog({ action: "CONTRACT_APPROVED", companyId, userId, entityId: id, meta, createdAt: now }, tx)`.
      - `meta = { unitId, unitPrice, finalPrice, downPayment, installmentCount, startDate }` (clarification Q2: unit price and final price side by side).
3. Return the detail DTO.

**Why it is correct**:
- At step 4 the approval holds the unit row lock, and its reservation is still active by the current DB time.
  - `releaseExpired` frees only units with no active reservation at its own `now()`, which is ≤ this clock. So it could not have freed this unit before step 3.
  - It cannot free it after step 3 either, because the unit is locked.
  - A reserve needs `AVAILABLE`.
- So the `RESERVED` status the approval sees belongs to this contract's reservation.
- Approval time, start date and audit time all come from one DB clock read (phase 4 R4: one clock, the DB's).

**Lock order and deadlocks**:
- Approval locks **contract, then unit**.
- No other path locks a unit and then a contract:
  - reserve and release lock units only;
  - the price edit locks a unit only;
  - the draft edit locks the contract only.
- Approval does **not** call `releaseExpired`, so phase 4's rule "release first, then lock" holds trivially.
- No nested transactions: inside `withTransaction`, only repository functions that take `tx` are called, never a service such as `getUnit` (phase 4 R2).

**Concurrency outcomes**:
- Two approvals: the second waits at step 1, then sees `approvedAt` set → `CONTRACT_ALREADY_APPROVED`.
- Edit vs approve: see R4.

**Alternatives considered**:
- The agreed sequence alone. Rejected for the race above.
- `SERIALIZABLE` with retries. It works, but adds a retry loop for one path.
- An `EXISTS (… expires_at > clock_timestamp())` inside the conditional unit update. It is one statement, but it depends on subtle re-check behaviour (EvalPlanQual) that phase 4 R2 has already shown can surprise. An explicit lock is easier to explain.

## R6. Installment status and remaining amount: computed on read

**Decision**: `installmentStatus({ amount, paidAmount, dueDate }, today)` in `src/features/contracts/domain/installment-status.ts` (agreed):
1. `paidAmount === amount` → `PAID`;
2. `dueDate < today` → `OVERDUE` (wins over partial);
3. `paidAmount > 0` → `PARTIAL`;
4. else `UNPAID`.

- `today` is the Saudi calendar date (`YYYY-MM-DD`) of the DB clock read for that request. Both values are `YYYY-MM-DD` strings, so `<` compares them correctly.
- `remaining = finalPrice − Σ paidAmount` (`contractRemaining` in the same file). It is 0 paid after approval in this phase; phase 6 changes `paidAmount`.
- A draft has no stored lines, so its remaining amount = `finalPrice` (spec Assumptions).
- Nothing is stored (constitution III).

## R7. Read model and DTOs

**Decision**:
- **`ContractListItemDto`**: `{ id, status: "DRAFT" | "APPROVED", reservationExpired, unit: { id, projectName, number }, client: { id, name }, salesRep: { id, name }, finalPrice, remaining, approvedAt: string | null }`.
- **`ContractDetailDto`**: the list fields plus:
  - `unit.price`, `reservation: { id, expiresAt }`, `downPayment`, `installmentCount`, `startDate: string | null`, `today`, `minFinalPrice`;
  - `schedule: { estimated: boolean, lines: ScheduleLineDto[] }`.
  - For a draft, `lines` = `buildSchedule(terms, today)` with `estimated: true` and no `paidAmount` or `status`.
  - For an approved contract, `lines` = the stored rows with `paidAmount` and `status`, and `estimated: false`.
- **`ContractOptionsDto`** (create form): `{ reservation: { id, expiresAt }, unit: { id, projectName, number, price }, client: { id, name }, minFinalPrice, today, contractId: string | null }`. `getContractOptions` is SALES only and scoped to the rep's own reservation (404 otherwise).
- `status` and `reservationExpired` are derived: `approvedAt` set → `APPROVED`. A draft with `expiresAt <= now` → `reservationExpired: true`.
- Every DTO uses `number` for money and ISO strings for dates (AGENTS §B). `dueDate`, `startDate` and `today` are `YYYY-MM-DD`.

**List query**:
- `findContracts(companyId, { salesRepId?, skip, take }, tx?)` filters by `companyId`, plus `reservation: { salesRepId }` for SALES.
- Order: `[{ approvedAt: { sort: "desc", nulls: "first" } }, { id: "asc" }]`. Drafts come first, then the newest approvals, and `id` breaks ties (FR-027, clarification Q4: no filter).
- `remaining` uses one grouped query: `installment.groupBy({ by: ["contractId"], _sum: { paidAmount } })` for the page's approved ids.

**"Today" comes from the server**:
- The list, detail and options services read `dbNow()` once and pass `today = toRiyadhDate(now)` to the DTO.
- The client preview uses that `today`, not the browser clock. Server and client renders match, and a wrong device clock or zone cannot change the dates (phase 4 R11 did the same with `asOf`).

## R8. Dates: Riyadh calendar date ⇄ `@db.Date`

**Decision**:
- `toRiyadhDate(instant: Date): string` = `format(new TZDate(instant, "Asia/Riyadh"), "yyyy-MM-dd")`, added to `src/shared/lib/dates.ts` (phase 4 file).
- Store: `dueDate: new Date(`${line.dueDate}T00:00:00.000Z`)`, which is UTC midnight of the calendar date.
  - Prisma writes the UTC date part to a `date` column, so the stored day equals the string.
- Read: `row.dueDate.toISOString().slice(0, 10)`.

**Rationale**:
- A `Date` built at Riyadh midnight is 21:00 UTC on the **previous** day, and Prisma would store the previous day.
- Keeping calendar dates as strings in the domain avoids that off-by-one.
- An integration test reads stored due dates back and compares them with `buildSchedule`'s output (approval test).

**Tests**:
- Unit test: `toRiyadhDate(2027-01-30T22:00:00Z) === "2027-01-31"` covers spec Story 2 scenario 5.
- An integration test cannot set the DB clock, so this scenario is proven at the unit level.

## R9. Schema change: one new migration

**Decision**: `prisma/migrations/<timestamp>_contracts_guards/migration.sql`, created with `prisma migrate dev --create-only` and filled with raw SQL. No new table or column.

1. `ALTER TABLE contracts ADD CONSTRAINT contracts_final_price_max_check CHECK (final_price <= 100000000000);`
   - It mirrors `units_price_max_check` from phase 3.
   - It keeps every money `Number(bigint)` conversion below 2^53 (clarification Q2: global cap 1,000,000,000 riyals). The down payment is `< final_price`, so it is capped too.
2. A trigger `contracts_approved_immutable` (`BEFORE UPDATE OR DELETE ON contracts`) raises when `OLD.approved_at IS NOT NULL`.
   - This is the DB guard for "an approved contract cannot be changed" (spec FR-018, constitution V).
   - The approval's own `UPDATE` has `OLD.approved_at IS NULL`, so it passes.
   - Phase 6 does not update contract rows; payments change `installments.paid_amount` only.
3. A trigger `installments_terms_immutable`:
   - `BEFORE UPDATE ON installments` raises if `contract_id`, `seq`, `due_date` or `amount` changes, so only `paid_amount` may change (phase 6);
   - `BEFORE DELETE` raises.
   - Once created, a schedule is fixed.

**Not in the DB**:
- `installment_count <= 120`: the user asked for one constant in code (clarification Q1). A DB check would be a second place to change.
- "Lines sum to the final price": a deferred constraint trigger could check it, but it adds a moving part for a rule that has one writer (approval, R5). It is proven by unit tests (all combinations) and by the approval integration test.

**Tests**: `tests/integration/prisma/contracts-guards.test.ts`:
- final price above the cap → `23514`;
- `UPDATE` of an approved contract → error; `UPDATE` of a draft → ok;
- `UPDATE installments SET amount` → error; `SET paid_amount` → ok; `DELETE` → error.

## R10. Status codes and check order

| Case | Code | HTTP |
|---|---|---|
| Body not JSON; field missing or out of range; down payment ≥ final price; less than 1 riyal per installment; final price below the minimum; bad paging | `VALIDATION_ERROR` + `fieldErrors` | 400 |
| Path id not a UUID | `NOT_FOUND` (phase 3 rule for path params) | 404 |
| Create or edit by MANAGER or ACCOUNTANT; approve by MANAGER or SALES; options by non-SALES | `FORBIDDEN` | 403 |
| Reservation or contract of another rep (SALES), of another company, or missing | `NOT_FOUND` | 404 |
| Reservation already has a contract (also from a parallel create) | `CONTRACT_EXISTS` | 409 |
| Edit or approve an approved contract | `CONTRACT_ALREADY_APPROVED` | 409 |
| Approve with values that differ from the stored draft | `CONTRACT_CHANGED` | 409 |
| Create, edit or approve while the reservation is expired | `RESERVATION_EXPIRED` | 409 |

**Order**: Origin → session 401 → path id 404 → body schema 400 → role 403 → record 404 → state 409 → minimum price 400.
- The role is checked before the record, as phase 3 R3 does for creates.
- For edit and approve, the role is also checked first. A rep that is not SALES has no way to edit, so a 403 reveals nothing.

**Arabic messages** (`src/shared/lib/error-messages.ts`):
- `CONTRACT_EXISTS`: "يوجد عقد لهذا الحجز بالفعل"
- `CONTRACT_ALREADY_APPROVED`: "تم اعتماد هذا العقد ولا يمكن تعديله"
- `CONTRACT_CHANGED`: "تم تعديل العقد بعد أن فتحته، راجع القيم الجديدة ثم اعتمد مرة أخرى"
- `RESERVATION_EXPIRED`: "انتهت مدة الحجز، لا يمكن إنشاء العقد أو تعديله أو اعتماده"

## R11. UI and routing

**Decision**:
- **Pages** (each calls `requireUser()`, parses params with the feature schema, prefetches with the same key factory, and renders one feature component in a `HydrationBoundary`):
  - `/contracts`: list (all roles).
  - `/contracts/new?reservationId=…`: create form. SALES only; other roles → `redirect("/contracts")`.
  - `/contracts/[id]`: detail with schedule and the approve action (ACCOUNTANT).
  - `/contracts/[id]/edit`: edit form. SALES only; others → `redirect` to the detail page.
- **A form page, not a dialog**: the form shows a schedule preview of up to 121 lines, which fits a page better than a dialog. Phase 3 used pages for create and edit too.
- **Form**: `ContractForm` (React Hook Form + `zodResolver(contractTermsInputSchema)`).
  - Money fields use the shared `MoneyInput` (phase 3).
  - `useWatch` on the three values → `buildSchedule(values, today)` → `SchedulePreview`, shown only when the values pass the schema. The label is "التواريخ تقديرية، وتُثبَّت عند الاعتماد" (clarification Q3).
  - The minimum price is shown under the final price field. A value below it gets a field error from `minFinalPrice` before submit.
  - 400 `fieldErrors` → `applyApiError`. 409 → message at the top of the form.
- **Approve**: `ApproveContractButton` on the detail page for ACCOUNTANT when `status === "DRAFT" && !reservationExpired`.
  - It sends the three values from the detail DTO it is showing.
  - On 409 `CONTRACT_CHANGED` it shows the message and invalidates the detail, so the new values appear (FR-021).
- **Schedule table**: `ScheduleTable` shows seq ("الدفعة المقدمة" for seq 0), due date, amount, paid amount and a status badge (غير مدفوع / مدفوع جزئياً / مدفوع / متأخر). For a draft it shows the "estimated" label and only seq, date and amount.
- **Reservations page (phase 4)**:
  - `ReservationDto` gains `contractId: string | null`.
  - The reservations table shows "إنشاء عقد" (a link to `/contracts/new?reservationId=…`) for SALES when `contractId === null`, and "عرض العقد" (a link to `/contracts/<id>`) otherwise.
  - These are links built from the id. The reservations feature imports no contracts code (the dependency direction is contracts → reservations).
- **After a mutation**, invalidate `contractKeys.all`. Create and approve also invalidate `["reservations"]` and `["units"]`. The contracts feature receives those keys as props from `page.tsx` (phase 4 R7 pattern, see R12).
- **Navigation**: add `{ href: "/contracts", label: "العقود", roles: ROLES }` (phase 2 map).

## R12. Cross-feature imports

| From (contracts) | Imports | Allowed by |
|---|---|---|
| `contracts/server/contracts.service.ts` | `units/server/index.ts` › `lockUnit`, `markUnitSold` (new) | contracts → units (AGENTS §2: payments → contracts → reservations → units) |
| `contracts/server/contracts.repository.ts` | Prisma only; reads `reservations`, `units`, `clients`, `users`, `installments` | repositories may read any table (phase 4 R6) |
| `contracts/client/*` | nothing from other features | AGENTS §2 |

- After create and approve, the units list and the reservations list must refresh (FR-035).
- The contracts client code cannot import `unitKeys` or `reservationKeys`.
- The query keys are passed as props from `page.tsx`, following the slot pattern of phase 4 R7:
  - `ContractForm` and `ApproveContractButton` take `relatedQueryKeys: readonly (readonly unknown[])[]`;
  - `page.tsx` passes `[unitKeys.all, reservationKeys.all]`.
- `page.tsx` may import from several features (AGENTS §2 as amended in phase 4).

The units feature gains two repository exports:
- `lockUnit(companyId, unitId, tx)`: `SELECT status … FOR UPDATE`;
- `markUnitSold(companyId, unitId, tx)`: `updateMany WHERE status = 'RESERVED'` → `SOLD`.

These follow phase 4's `reserveUnitIfAvailable` / `findUnitStatus` exports. The units feature does not import contracts.

## R13. Proving all-or-nothing approval

**Decision**: `contracts.service.test.ts` › "approval › all-or-nothing":
1. Make a draft with an active reservation.
2. In the test, create a temporary trigger on the real test DB:
   - `CREATE FUNCTION test_fail_audit() … RAISE EXCEPTION 'forced failure'`;
   - `CREATE TRIGGER test_fail_audit BEFORE INSERT ON audit_logs FOR EACH ROW WHEN (NEW.action = 'CONTRACT_APPROVED' AND NEW.entity_id = '<contractId>') EXECUTE FUNCTION test_fail_audit()`.
   - The audit row is the **last** write of approval, so every earlier step has already run inside the transaction.
3. `approveContract(...)` rejects.
4. Assert:
   - contract `approvedAt` is null;
   - unit status is `RESERVED`;
   - 0 installments for the contract;
   - 0 `CONTRACT_APPROVED` audit rows for it.
5. `finally`: drop the trigger and the function.

**Rationale**:
- This is a real DB failure, so there is no mock (AGENTS §8: never mock the DB).
- The trigger is scoped to one contract id, so other tests are not affected. Integration files run one at a time (`fileParallelism: false`).

**Alternatives considered**:
- A failing installment row, such as amount 0. This is impossible through `buildSchedule`, and it would test the trigger less directly.
- Injecting a failing repository. Rejected: it would be a mock.

## R14. Proving concurrency

All on real Postgres in `contracts.service.test.ts`, using `Promise.allSettled`:
1. **Two approvals of one draft** (×10): exactly 1 fulfilled and 1 `CONTRACT_ALREADY_APPROVED`, one set of installments, and 1 audit row.
2. **Edit vs approve** (×10): either the edit fulfils and the approval gives `CONTRACT_CHANGED` (contract still a draft), or the approval fulfils and the edit gives `CONTRACT_ALREADY_APPROVED` (approved values unchanged). Never both fulfilled.
3. **Two creates for one reservation**: 1 fulfilled and 1 `CONTRACT_EXISTS`, with 1 contract row.
4. **Expiry vs approval**: a reservation whose `expiresAt` is in the past → `RESERVATION_EXPIRED`, the unit is not sold, and there is no schedule.
   - The narrow race in R5 (approval transaction started before expiry) cannot be timed reliably in a test.
   - It is covered by design: the lock plus `clock_timestamp()`, explained in the README "Technical decisions".

## R15. Dependencies

- **No new npm dependency.** `date-fns` and `@date-fns/tz` were installed in phase 0. Zod, React Hook Form, TanStack Query, sonner and shadcn are already used.
- No property-testing library: a deterministic loop over many value combinations covers the "sum equals final price" invariant (FR-038).
- No new shadcn primitive is expected: `table`, `badge`, `card`, `alert` and `button` exist, and `dialog` comes from phase 4.

## R16. Dependencies on phase 4

| Name (phase 4, as on its branch) | Used for |
|---|---|
| `units/server/index.ts` exports (adds `lockUnit`, `markUnitSold` next to phase 4's `reserveUnitIfAvailable`) | approval |
| `src/shared/lib/dates.ts` › `formatRiyadhDateTime` (+ new `toRiyadhDate`, `formatRiyadhDate`) | dates on screen; start date |
| `reservations.types.ts` › `ReservationDto` (+ `contractId`) | "create contract" / "view contract" links |
| reservations list repository (select the contract id) | same |
| `reservations-page/components/reservations-table/reservations-table.tsx` | the links |
| `reservationKeys.all` | invalidation after create and approve |
| phase 4 R2 rules: no nested transactions; release before locks | approval design (R5) |

Phase 4 must be merged into `main` and this branch rebased before `/speckit-implement`. If phase 4 lands with different names, `/speckit-tasks` adapts the calls. The behaviour does not change.

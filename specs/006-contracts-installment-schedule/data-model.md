# Data Model: Contracts and Installment Schedule

This phase uses the phase 1 tables `contracts` and `installments` (`prisma/schema.prisma`, migration `20261112121333_init_schema`).
- It adds no table and no column.
- The only schema change is one migration with a price cap and two immutability triggers ([research R9](./research.md#r9-schema-change-one-new-migration)).

## Contract (`contracts`)

| Field | Type (DB) | Rules (DB) | Rules (input schema, `contracts.schemas.ts`) |
|---|---|---|---|
| id | uuid | PK, default `gen_random_uuid()` | path param only; not a UUID → 404 |
| companyId | uuid | FK → companies; composite FK `(company_id, reservation_id)` → reservations | never in input; from session |
| reservationId | uuid | unique (`contracts_reservation_id_key`, `contracts_company_id_reservation_id_key`) | create only: `z.uuid()` |
| finalPrice | bigint (halalas) | `> 0`; **new**: `<= 100000000000` | integer 1 … 100,000,000,000; service: `>= minFinalPrice(unit.price)` |
| downPayment | bigint (halalas) | `>= 0 AND < final_price` | integer 0 … 100,000,000,000; refine: `< finalPrice` |
| installmentCount | int | `>= 1` | integer 1 … `MAX_INSTALLMENTS` (120); refine: `finalPrice − downPayment >= installmentCount × 100` |
| approvedAt | timestamptz, null | null = draft; **new trigger**: a row with `approved_at` set can never be updated or deleted | **never in input**; set by approval from the DB clock |

**Not stored** (phase 1 plan notes): status, unitId, clientId, salesRepId, start date, remaining amount.
- **Status** is `APPROVED` if `approvedAt` is set, else `DRAFT`.
- **Unit, client and rep** come from the reservation.
- **Start date** = `toRiyadhDate(approvedAt)`.
- **Remaining** = `finalPrice − Σ installments.paidAmount`.

**Input schemas** (built with `.pick()`, never `.omit()`; extra keys stripped):
- `contractTermsInputSchema = contractSchema.pick({ finalPrice, downPayment, installmentCount }).superRefine(contractTermsRefine)`. It is used for edit (PATCH) and approve (POST `/approve`, the values the accountant saw), and by the form.
- `createContractInputSchema = contractSchema.pick({ reservationId, finalPrice, downPayment, installmentCount }).superRefine(contractTermsRefine)`.
- `contractListQuerySchema = z.object({ ...paginationFields })`. There is no status filter (clarification Q4).
- `contractOptionsQuerySchema = contractSchema.pick({ reservationId })`.

### State transitions

| From | To | Trigger | Guard |
|---|---|---|---|
| — | DRAFT | create (SALES, own active reservation, no contract yet) | unique `reservation_id`; service checks |
| DRAFT | DRAFT (new values) | edit (owning SALES, reservation active) | `UPDATE … WHERE approved_at IS NULL`; DB trigger |
| DRAFT | APPROVED | approve (ACCOUNTANT, reservation active, values unchanged) | contract `FOR UPDATE`, unit `FOR UPDATE`, `clock_timestamp()` check, conditional unit update ([R5](./research.md#r5-approval-one-transaction-contract-lock-then-unit-lock-departure-adds-a-unit-lock)) |
| APPROVED | — | none | DB trigger refuses any update or delete |

A draft whose reservation expired stays as history. It cannot be edited or approved, and it shows `reservationExpired: true`.

## Installment (`installments`)

| Field | Type (DB) | Rules (DB) | Set by |
|---|---|---|---|
| id | uuid | PK | DB |
| contractId | uuid | FK → contracts; unique `(contract_id, seq)` | approval |
| seq | int | `>= 0`; 0 = down payment, 1 … n = monthly | `buildSchedule` |
| dueDate | date | — | `buildSchedule`; stored as UTC midnight of the `YYYY-MM-DD` string ([R8](./research.md#r8-dates-riyadh-calendar-date--dbdate)) |
| amount | bigint (halalas) | `> 0` | `buildSchedule` |
| paidAmount | bigint (halalas) | `>= 0 AND <= amount`, default 0 | 0 here; phase 6 payments |

**New trigger** (`installments_terms_immutable`):
- `UPDATE` may change only `paid_amount`; changes to `contract_id`, `seq`, `due_date` or `amount` raise.
- `DELETE` raises.

**Created only on approval**, in the same transaction as the contract, the unit and the audit row. A draft has no rows.

**Status** (never stored; [R6](./research.md#r6-installment-status-and-remaining-amount-computed-on-read)):

| Order | Condition | Status | Arabic label |
|---|---|---|---|
| 1 | `paidAmount = amount` | PAID | مدفوع |
| 2 | `dueDate < today` (Riyadh) | OVERDUE | متأخر |
| 3 | `paidAmount > 0` | PARTIAL | مدفوع جزئياً |
| 4 | otherwise | UNPAID | غير مدفوع |

## Schedule rule (`buildSchedule`, domain)

For terms `{ finalPrice F, downPayment D, installmentCount n }` and start date `S`:
- If `D > 0`, line 0 = `D`, due `S`.
- `rest = F − D`, `base = ⌊rest / (n·100)⌋ · 100`.
- Lines 1 … n−1 = `base`, line n = `rest − base·(n−1)`.
- Line i is due on `addMonths(S, i)`. A missing day becomes the last day of the month.
- **Invariants**:
  - `Σ amounts = F`;
  - every line ≥ 100 halalas (needs `rest ≥ n·100`);
  - lines 1 … n−1 are whole riyals.

Examples (from the spec):

| F (SAR) | D | n | S | Lines |
|---|---|---|---|---|
| 100,000 | 0 | 3 | 2027-01-31 | 1: 33,333 @ 2027-02-28 · 2: 33,333 @ 2027-03-31 · 3: 33,334 @ 2027-04-30 |
| 100,000 | 10,000 | 3 | 2028-01-31 | 0: 10,000 @ 2028-01-31 · 1: 30,000 @ 2028-02-29 · 2: 30,000 @ 2028-03-31 · 3: 30,000 @ 2028-04-30 |
| 475,000.05 | 0.05 | 1 | 2027-03-15 | 0: 0.05 @ 2027-03-15 · 1: 475,000 @ 2027-04-15 |
| 2 | 0 | 3 | — | refused: less than 1 riyal per line |

## Audit log entry (`audit_logs`, action `CONTRACT_APPROVED`)

| Field | Value |
|---|---|
| companyId, userId | from the session (the accountant) |
| entityId | contract id |
| createdAt | the approval's DB clock read (same as `approvedAt`) |
| meta | `{ unitId, unitPrice, finalPrice, downPayment, installmentCount, startDate }`; money as integer halalas, `startDate` as `YYYY-MM-DD` (clarification Q2) |

No audit row is written for draft create or edit (spec Assumptions).

## Unit (`units`) — effect of this phase

| From | To | Where |
|---|---|---|
| RESERVED | SOLD | approval only: `lockUnit` (`FOR UPDATE`), then `markUnitSold` (`updateMany WHERE status = 'RESERVED'`) |

A SOLD unit never changes again. `releaseExpired` acts only on RESERVED units, so a sold unit stays sold after its reservation's 72 hours (FR-024).

## Reservation (`reservations`) — read only

- Used for ownership (`salesRepId`), "active" (`expiresAt > now`), and the unit and client of the contract.
- Phase 4's "active" already excludes reservations with an approved contract.
- This phase adds `contractId` to the phase 4 reservations list DTO for the "create / view contract" links.

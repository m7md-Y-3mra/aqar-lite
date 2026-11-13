# Contract: Contracts API

Every route goes through phase 2's `handleRoute({ auth: "user" })`:
- A missing or expired session gives 401 `UNAUTHORIZED`.
- A `POST` or `PATCH` whose `Origin` is not in `APP_ORIGIN` gives 403 `INVALID_ORIGIN`.
- Success: `{ "data": … }`. Error: `{ "error": { "code", "message", "fieldErrors"? } }`, with the message in Arabic from `src/shared/lib/error-messages.ts`.

`companyId` and the user always come from the session. They are never read from the body, the query or the path.

Money is integer halalas (`number`). Instants are ISO strings. Calendar dates (`dueDate`, `startDate`, `today`) are `YYYY-MM-DD` in Saudi time.

A path `id` that is not a UUID → 404 `NOT_FOUND` (phase 3 rule).

## Shared shapes

```ts
type ContractStatus = "DRAFT" | "APPROVED";
type InstallmentStatus = "UNPAID" | "PARTIAL" | "PAID" | "OVERDUE";

type ContractListItemDto = {
  id: string;
  status: ContractStatus;
  reservationExpired: boolean;        // true only for a DRAFT whose reservation expired
  unit: { id: string; projectName: string; number: string };
  client: { id: string; name: string };
  salesRep: { id: string; name: string };
  finalPrice: number;
  remaining: number;                  // finalPrice − Σ paidAmount; = finalPrice for a draft
  approvedAt: string | null;
};

type ScheduleLineDto =
  | { seq: number; dueDate: string; amount: number }                                         // draft preview
  | { seq: number; dueDate: string; amount: number; paidAmount: number; status: InstallmentStatus }; // approved

type ContractDetailDto = ContractListItemDto & {
  unit: { id: string; projectName: string; number: string; price: number };
  reservation: { id: string; expiresAt: string };
  downPayment: number;
  installmentCount: number;
  minFinalPrice: number;              // ceil(unit.price × 95 / 100)
  startDate: string | null;           // approval date in Riyadh; null for a draft
  today: string;                      // Riyadh date of the server clock for this request
  schedule: { estimated: boolean; lines: ScheduleLineDto[] };
};
```

## `GET /api/contracts?page=&pageSize=`

The contracts list.
- MANAGER and ACCOUNTANT: every contract of the company.
- SALES: contracts whose reservation's `salesRepId` is the session user.
- Order: drafts first, then approved by `approvedAt` descending, `id` ascending as the tie-breaker.
- No status filter (clarification Q4).

**200**: `{ "data": { "items": ContractListItemDto[], "total", "page", "pageSize" } }`

**Errors**: 400 `VALIDATION_ERROR` (`page` < 1, `pageSize` > 50, or not digits).

## `GET /api/contracts/options?reservationId=`

Data for the create form. **SALES only.**

**200**:

```json
{ "data": {
  "reservation": { "id": "uuid", "expiresAt": "2026-11-16T09:00:00.000Z" },
  "unit": { "id": "uuid", "projectName": "…", "number": "…", "price": 50000000 },
  "client": { "id": "uuid", "name": "…" },
  "minFinalPrice": 47500000,
  "today": "2026-11-13",
  "contractId": null
} }
```

- `contractId` is set when the reservation already has a contract. The page then links to it instead of showing the form.
- An expired reservation still answers 200, with `expiresAt` in the past. The page shows the "reservation expired" message instead of the form.

**Errors**:

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` + `fieldErrors.reservationId` | missing or not a UUID |
| 403 | `FORBIDDEN` | MANAGER or ACCOUNTANT |
| 404 | `NOT_FOUND` | reservation of another rep, of another company, or missing |

## `POST /api/contracts`

Create a draft. **SALES only.**

**Body** (`createContractInputSchema`; extra keys such as `approvedAt`, `companyId`, `status` or `schedule` are stripped):

```json
{ "reservationId": "uuid", "finalPrice": 10000000, "downPayment": 0, "installmentCount": 3 }
```

**201**: `{ "data": ContractDetailDto }` with `status: "DRAFT"` and `schedule.estimated: true`.

**Errors**:

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` + `fieldErrors.finalPrice` | missing, not an integer, < 1, > 1e11, or below `minFinalPrice` (the message names the minimum in riyals) |
| 400 | `VALIDATION_ERROR` + `fieldErrors.downPayment` | missing, < 0, or ≥ `finalPrice` |
| 400 | `VALIDATION_ERROR` + `fieldErrors.installmentCount` | not an integer 1 … 120, or `finalPrice − downPayment < installmentCount × 100` |
| 400 | `VALIDATION_ERROR` + `fieldErrors.reservationId` | missing or not a UUID |
| 403 | `FORBIDDEN` | MANAGER or ACCOUNTANT |
| 404 | `NOT_FOUND` | reservation of another rep, of another company, or missing |
| 409 | `CONTRACT_EXISTS` | the reservation already has a contract (also the loser of two parallel creates) |
| 409 | `RESERVATION_EXPIRED` | the reservation's `expiresAt` ≤ DB now |

## `GET /api/contracts/{id}`

One contract with its schedule.
- MANAGER and ACCOUNTANT: any contract of the company.
- SALES: only contracts from their own reservations; any other id → 404.

**200**: `{ "data": ContractDetailDto }`
- **Draft**: `schedule.estimated = true`. The lines are `buildSchedule(terms, today)`, with no `paidAmount` or `status`. `startDate` is null.
- **Approved**: `schedule.estimated = false`. The lines are the stored rows with `paidAmount` and the computed `status`. `startDate` is the approval date in Riyadh.

**Errors**: 404 `NOT_FOUND` (another company, another rep's contract for SALES, missing, or a malformed id).

## `PATCH /api/contracts/{id}`

Edit a draft's terms. **SALES only, owner only.**

**Body** (`contractTermsInputSchema`):

```json
{ "finalPrice": 10000000, "downPayment": 1000000, "installmentCount": 6 }
```

**200**: `{ "data": ContractDetailDto }`

**Errors**:

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` + `fieldErrors.*` | the same value rules as create |
| 403 | `FORBIDDEN` | MANAGER or ACCOUNTANT |
| 404 | `NOT_FOUND` | another rep's contract, another company's, missing, or a malformed id |
| 409 | `CONTRACT_ALREADY_APPROVED` | the contract is approved, including when approval committed while this request waited |
| 409 | `RESERVATION_EXPIRED` | the draft's reservation expired |

## `POST /api/contracts/{id}/approve`

Approve a draft. **ACCOUNTANT only.**

**Body** (`contractTermsInputSchema`): the three values the accountant saw on the page.

```json
{ "finalPrice": 10000000, "downPayment": 1000000, "installmentCount": 6 }
```

**200**: `{ "data": ContractDetailDto }` with `status: "APPROVED"`, `startDate` = today in Riyadh, and the stored schedule.

**Effects, all in one transaction** ([research R5](../research.md#r5-approval-one-transaction-contract-lock-then-unit-lock-departure-adds-a-unit-lock)):
- the contract gets `approvedAt`;
- the unit goes RESERVED → SOLD;
- installments are inserted;
- one `CONTRACT_APPROVED` audit row is written.

On any error none of these remain.

**Errors**:

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | body missing or malformed |
| 403 | `FORBIDDEN` | MANAGER or SALES |
| 404 | `NOT_FOUND` | another company's contract, missing, or a malformed id |
| 409 | `CONTRACT_ALREADY_APPROVED` | already approved (also the loser of two parallel approvals) |
| 409 | `CONTRACT_CHANGED` | any of the three values differs from the stored draft |
| 409 | `RESERVATION_EXPIRED` | the reservation's `expiresAt` ≤ DB clock after the unit lock, or the unit is not RESERVED |

## Not provided

`DELETE` and `PUT` on any contract route. There is no delete or cancel (out of scope).
- `src/app/api/contracts/route.ts` exports exactly `GET`, `POST`.
- `[id]/route.ts` exports exactly `GET`, `PATCH`.
- `[id]/approve/route.ts` exports exactly `POST`.
- `options/route.ts` exports exactly `GET`.

## UI contract

| Page | Roles | States |
|---|---|---|
| `/contracts` | all | skeleton; empty "لا توجد عقود بعد"; error with retry; rows with a status badge ("مسودة" / "معتمد" / "انتهى الحجز"); pagination |
| `/contracts/new?reservationId=` | SALES (others → `/contracts`) | loading; reservation expired → message + link to `/reservations`; contract exists → link to it; form with the min-price hint and a live preview labelled "التواريخ تقديرية، وتُثبَّت عند الاعتماد"; field errors; 409 at the top; submit disabled while pending |
| `/contracts/[id]` | all (scoped) | loading; not found; details; schedule (estimated label for a draft); "تعديل" for the owning SALES on an active draft; "اعتماد" for ACCOUNTANT on an active draft; 409 message at the top with a refreshed view |
| `/contracts/[id]/edit` | owning SALES (others → `/contracts/[id]`) | like the create form, prefilled; approved or expired → message and no form |
| `/reservations` (phase 4) | SALES | per row: "إنشاء عقد" when `contractId` is null, else "عرض العقد" |

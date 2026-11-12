# Data Model: Unit Reservations

This phase uses the tables from phase 1. Its one schema change is a migration on `reservations`: a `reserved_at` column, a check, and an exclusion constraint ([research R3](./research.md#r3-database-guard-no-two-overlapping-reservations-for-one-unit-schema-change)). It adds no table.

## Reservation (`reservations`)

| Field | Type (DB) | Rules (DB) | Set by |
|---|---|---|---|
| id | uuid | PK, default `gen_random_uuid()` | DB |
| companyId | uuid | composite FKs `(company_id, unit_id)`, `(company_id, client_id)`, `(company_id, sales_rep_id)` (phase 1) | session `companyId` |
| unitId | uuid | FK → units (same company) | request body (validated) |
| clientId | uuid | FK → clients (same company) | request body (validated; must be owned by the rep) |
| salesRepId | uuid | FK → users (same company) | session `userId` |
| **reservedAt** (new) | timestamptz(3) | `NOT NULL DEFAULT now()` | DB `now()` |
| expiresAt | timestamptz(3) | `NOT NULL`; **new**: `CHECK (expires_at > reserved_at)` | DB `now() + 72 hours` |

**New constraint**: `reservations_no_overlap EXCLUDE USING gist (unit_id WITH =, tstzrange(reserved_at, expires_at) WITH &&)` (needs `btree_gist`). Two reservations of one unit can never cover the same moment.

**Input schema** (`reservations.schemas.ts`):
- `reservationSchema` = `{ unitId: z.uuid(), clientId: z.uuid() }`.
- `reserveInputSchema = reservationSchema.pick({ unitId: true, clientId: true })`. Extra keys (`expiresAt`, `salesRepId`, `companyId`, `status`) are stripped.

**Active** (derived, never stored): `expires_at > now()` AND (no contract OR `contract.approved_at IS NULL`).

**Rows are never deleted** (FR-013). No update code exists for reservations.

### Lifecycle

| State | Condition | What can happen next |
|---|---|---|
| Active | `now() < expires_at`, no approved contract | phase 5: a draft contract; approval → unit SOLD |
| Expired | `now() >= expires_at`, no approved contract | kept as history; the unit is released on the next read or reserve |
| Converted | contract approved (phase 5) | kept; not listed as active; the unit stays SOLD |

## Unit status (`units.status`)

| From | To | Trigger | Where |
|---|---|---|---|
| AVAILABLE | RESERVED | reserve | `units.repository › reserveUnitIfAvailable` (conditional update, in the reserve transaction) |
| RESERVED | AVAILABLE | no active reservation | `units.repository › releaseExpired` (lock, then re-check; research R2) |
| RESERVED | SOLD | contract approval | phase 5 |
| SOLD | — | — | never |

## DTOs (JSON-safe; the same from the service and the API)

```ts
// reservations.types.ts
type ReservationDto = {
  id: string;
  expiresAt: string;                  // ISO
  reservedAt: string;                 // ISO
  unit: { id: string; projectName: string; number: string };
  client: { id: string; name: string };
  salesRep: { id: string; name: string };   // shown in the manager's view only (UI)
};

type ReservationPage = Page<ReservationDto> & { asOf: string };   // asOf = DB now() used for the "active" filter

type ReserveOptionsDto = {
  unit: { id: string; projectName: string; number: string; status: "AVAILABLE" | "RESERVED" | "SOLD" };
  clients: { id: string; name: string }[];   // the rep's own, first 50 by name
};

// units.types.ts (phase 3, changed)
type UnitDto = { /* phase 3 fields */ reservedUntil: string | null };  // ISO while RESERVED, else null; never client or rep
```

`salesRep` is included for both roles. A sales rep's list only holds their own rows, so it reveals nothing. The UI shows the column only to managers.

## Query parameters (`reservationListQuerySchema`)

| Param | Rule |
|---|---|
| page | int ≥ 1, default 1 |
| pageSize | int 1–50, default 20 |
| anything else | stripped |

Order is always `expires_at ASC, id ASC`.

`reserveOptionsQuerySchema`: `unitId` must be a UUID (400 otherwise).

## Audit

No audit rows in this phase. The brief's list (failed login, price change, approval, payment) does not include reservations.

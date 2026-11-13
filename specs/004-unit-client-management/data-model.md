# Data Model: Units and Clients

This phase uses the tables from phase 1 (`prisma/schema.prisma`, migrations `20261112121333_init_schema` and `20261112130237_append_only_guards`). It adds no table and no column. The only schema change is one migration with two check constraints on `clients` and one price cap on `units` (research R9).

## Unit (`units`)

| Field | Type (DB) | Rules (DB) | Rules (input schema, `units.schemas.ts`) |
|---|---|---|---|
| id | uuid | PK, default `gen_random_uuid()` | path param only; not a UUID → 404 |
| companyId | uuid | FK → companies | never in input; from session |
| projectName | text | trimmed, not empty; unique with `number` per company | trim; 1–100 chars |
| number | text | trimmed, not empty; unique `(company_id, project_name, number)` | trim; 1–20 chars |
| type | enum `UnitType` | APARTMENT, VILLA, TOWNHOUSE, DUPLEX | `z.enum` of the same 4 |
| area | int | `> 0` | integer 1–100,000 (m²) |
| rooms | int | `>= 0` | integer 0–50 |
| price | bigint (halalas) | `> 0`; **new**: `<= 100000000000` | integer halalas 1–100,000,000,000 (≤ 1,000,000,000 SAR) |
| status | enum `UnitStatus` | default AVAILABLE | **never in input**; read-only in DTO |

**Input schema**: `unitInputSchema = unitSchema.pick({ projectName, number, type, area, rooms, price })`. It is used for both create (POST) and edit (PATCH, full object). Extra keys (`status`, `companyId`, `id`) are stripped.

### Status transitions

| From | To | Trigger | Where |
|---|---|---|---|
| AVAILABLE | RESERVED | reservation | phase 4 (conditional update) |
| RESERVED | AVAILABLE | no reservation with `expires_at > now()` | `releaseExpired(companyId)`, this phase (research R2) |
| RESERVED | SOLD | contract approval | phase 5 |
| SOLD | — | none | never changes |

Users can never set the status. This phase writes status only in `releaseExpired`.

### Price lock

- A price change (new ≠ stored) succeeds only while status = AVAILABLE at the moment of the update (research R1).
- An edit that keeps the price may change the other fields in any status (clarified 2026-11-12).

## Client (`clients`)

| Field | Type (DB) | Rules (DB) | Rules (input schema, `clients.schemas.ts`) |
|---|---|---|---|
| id | uuid | PK | path param only; not a UUID → 404 |
| companyId | uuid | FK → companies | never in input; from session |
| salesRepId | uuid | composite FK `(company_id, sales_rep_id)` → users | never in input; = session `userId` on create, never changed |
| name | text | **new**: trimmed, not empty | trim; 1–100 chars |
| phone | text | **new**: trimmed, not empty; **not unique** | trim; `^\+?[0-9][0-9 -]{5,18}$` (7–20 chars, digits, optional leading `+`, spaces, dashes) |
| notes | text, nullable | — | trim; 0–2,000 chars; empty → `null`; line breaks kept |

**Input schema**: `clientInputSchema = clientSchema.pick({ name, phone, notes })`. It is used for create and edit.

### Visibility

| Role | Reads | Writes |
|---|---|---|
| SALES | rows where `salesRepId = session.userId` | create (owned by self); edit own rows only |
| MANAGER | all rows of the company | none |
| ACCOUNTANT | all rows of the company | none |

## Audit entry (`audit_logs`, written, never read in this phase)

| Field | Value for a price change |
|---|---|
| companyId | session company |
| userId | session user (the manager) |
| action | `PRICE_CHANGED` |
| entityId | unit id |
| meta | `{ "oldPrice": <int halalas>, "newPrice": <int halalas> }` |
| createdAt | DB default `now()` |

- Written in the same transaction as the price update, only when the conditional update changed exactly 1 row.
- Not written on unit create, nor when an edit keeps the price.
- Rows are append-only (phase 1 triggers).

## Reservation (`reservations`, read only)

Used only by `releaseExpired`, through a SQL `NOT EXISTS` on `(unit_id, expires_at)`. The `reservations_unit_id_expires_at_idx` index covers it. This phase has no reservation code.

## DTOs (JSON-safe; same from the service and the API)

```ts
type UnitDto = {
  id: string; projectName: string; number: string;
  type: "APARTMENT" | "VILLA" | "TOWNHOUSE" | "DUPLEX";
  area: number; rooms: number; price: number;           // price in halalas
  status: "AVAILABLE" | "RESERVED" | "SOLD";
};

type ClientDto = {
  id: string; name: string; phone: string; notes: string | null;
  salesRep: { id: string; name: string };
};

type Page<T> = { items: T[]; total: number; page: number; pageSize: number };
```

`price` is converted from `bigint` with `Number()` in the service mapper. This is safe because the database (`units_price_max_check`) and the input schema both cap it at ≤ 10^11, which is below 2^53.

## List queries

| Param | Units | Clients | Rule |
|---|---|---|---|
| status | AVAILABLE \| RESERVED \| SOLD | — | optional |
| minPrice, maxPrice | int halalas ≥ 0 | — | optional; both inclusive; `minPrice > maxPrice` → 400 |
| sort | price \| area | — | optional; omitted → project name, number |
| order | asc \| desc | — | default asc; ignored without `sort` |
| page | int ≥ 1 | int ≥ 1 | default 1 |
| pageSize | int 1–50 | int 1–50 | default 20 |
| anything else | ignored | ignored | stripped |

Ordering always ends with `id ASC` (research R12).

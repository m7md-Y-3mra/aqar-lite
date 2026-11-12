# Data Model: Database Schema and Seed

**Feature**: `002-schema-seed` | **Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

Postgres table and column names are snake_case (`@@map` / `@map`). Prisma model and field names are camelCase.
Every relation sets `onDelete: Restrict, onUpdate: Restrict` (R2). Constraint names are listed in
[contracts/database.md](./contracts/database.md); tests assert them.

## Enums

| Enum | Values |
|---|---|
| `Role` | `MANAGER`, `SALES`, `ACCOUNTANT` |
| `UnitType` | `APARTMENT`, `VILLA`, `TOWNHOUSE`, `DUPLEX` (clarification Q2) |
| `UnitStatus` | `AVAILABLE` (default), `RESERVED`, `SOLD` |
| `AuditAction` | `LOGIN_FAILED`, `PRICE_CHANGED`, `CONTRACT_APPROVED`, `PAYMENT_RECORDED` |

## Entities

Types: `uuid` = `@db.Uuid` with `DEFAULT gen_random_uuid()`; `bigint` = halalas (`BigInt`); `tstz` = `timestamptz(3)`.

### Company — `companies`

| Field | Type | Rules |
|---|---|---|
| id | uuid | PK |
| name | text | |

### User — `users`

| Field | Type | Rules |
|---|---|---|
| id | uuid | PK; `UNIQUE (company_id, id)` (target of company-aware FKs) |
| companyId | uuid | FK → companies |
| name | text | |
| email | text | `UNIQUE`; `CHECK email = lower(btrim(email)) AND email <> ''` (R4) |
| passwordHash | text | Argon2id hash string; never selected into a DTO |
| role | Role | |

### Session — `sessions`

| Field | Type | Rules |
|---|---|---|
| id | text | PK = hex SHA-256 of the token; the raw token is never stored |
| userId | uuid | FK → users; index |
| expiresAt | tstz | |

### Unit — `units`

| Field | Type | Rules |
|---|---|---|
| id | uuid | PK; `UNIQUE (company_id, id)` |
| companyId | uuid | FK → companies |
| projectName | text | `CHECK = btrim(...) AND <> ''` |
| number | text | `CHECK = btrim(...) AND <> ''` |
| type | UnitType | |
| area | integer | whole m² (clarification Q1); `CHECK > 0` |
| rooms | integer | `CHECK >= 0` |
| price | bigint | `CHECK > 0` |
| status | UnitStatus | default `AVAILABLE` |

Also: `UNIQUE (company_id, project_name, number)`; index `(company_id, status)` for the list filter.
The trim checks stop `"A-101 "` from slipping past the unique rule.

### Client — `clients`

| Field | Type | Rules |
|---|---|---|
| id | uuid | PK; `UNIQUE (company_id, id)` |
| companyId | uuid | FK → companies |
| salesRepId | uuid | FK `(company_id, sales_rep_id) → users(company_id, id)` (same company) |
| name | text | |
| phone | text | **not unique** (FR-022) |
| notes | text? | free text, shown as plain text |

Index `(company_id, sales_rep_id)` for "a rep sees only his clients".

### Reservation — `reservations`

| Field | Type | Rules |
|---|---|---|
| id | uuid | PK; `UNIQUE (company_id, id)` |
| companyId | uuid | FK → companies |
| unitId | uuid | FK `(company_id, unit_id) → units(company_id, id)` |
| clientId | uuid | FK `(company_id, client_id) → clients(company_id, id)` |
| salesRepId | uuid | FK `(company_id, sales_rep_id) → users(company_id, id)` |
| expiresAt | tstz | active ⇔ `expires_at > now()`; no status column |

Indexes: `(unit_id, expires_at)` (phase 3 `releaseExpired`, phase 4 active check), `(company_id, sales_rep_id)`.

### Contract — `contracts`

| Field | Type | Rules |
|---|---|---|
| id | uuid | PK |
| companyId | uuid | FK → companies |
| reservationId | uuid | `UNIQUE` (one contract per reservation); FK `(company_id, reservation_id) → reservations(company_id, id)`; `UNIQUE (company_id, reservation_id)` (needed by Prisma for the 1-to-1 composite FK, R1) |
| finalPrice | bigint | `CHECK > 0` |
| downPayment | bigint | `CHECK >= 0 AND < final_price` |
| installmentCount | integer | `CHECK >= 1` |
| approvedAt | tstz? | null = draft |

No status, unit, client or sales rep columns: they come from the reservation.

### Installment — `installments`

| Field | Type | Rules |
|---|---|---|
| id | uuid | PK |
| contractId | uuid | FK → contracts |
| seq | integer | 0 = down payment; `CHECK >= 0`; `UNIQUE (contract_id, seq)` |
| dueDate | date | Prisma reads/writes UTC midnight (see contracts/database.md) |
| amount | bigint | `CHECK > 0` |
| paidAmount | bigint | default 0; `CHECK >= 0 AND <= amount` |

Status (unpaid / partial / paid / overdue) is computed on read (phase 5), never stored.

### Payment — `payments` (append-only)

| Field | Type | Rules |
|---|---|---|
| id | uuid | PK |
| contractId | uuid | FK → contracts |
| amount | bigint | `CHECK > 0` |
| idempotencyKey | text | `CHECK <> ''`; `UNIQUE (contract_id, idempotency_key)` |
| createdAt | tstz | default `now()` |

Triggers reject UPDATE, DELETE and TRUNCATE (SQLSTATE `AQ001`). No allocation table: allocation goes in the audit row's `meta`.

### AuditLog — `audit_logs` (append-only)

| Field | Type | Rules |
|---|---|---|
| id | uuid | PK |
| companyId | uuid? | FK → companies; null for a failed login with an unknown email |
| userId | uuid? | FK → users; null for a failed login with an unknown email |
| action | AuditAction | |
| entityId | uuid? | the unit, contract or payment the row is about |
| meta | jsonb | default `{}`; `LOGIN_FAILED` rows carry `meta.email`, normalized (`CHECK`, R4) |
| createdAt | tstz | default `now()` |

Indexes: `(company_id, created_at)` (phase 7 list, newest first) and the partial expression index
`((meta ->> 'email'), created_at) WHERE action = 'LOGIN_FAILED'` (phase 2 lockout count).
Triggers reject UPDATE, DELETE and TRUNCATE (SQLSTATE `AQ001`).

## Relationships

```text
companies 1─* users 1─* sessions
companies 1─* units
companies 1─* clients   *─1 users (sales rep, same company)
companies 1─* reservations *─1 units / clients / users (all same company)
reservations 1─0..1 contracts (same company)
contracts 1─* installments
contracts 1─* payments
companies 0..1─* audit_logs *─0..1 users
```

Installments and payments have no `company_id`: they are always reached through their contract, which is scoped by company.

## State transitions (enforced by later phases, not by the schema)

| Entity | Transition | Owner |
|---|---|---|
| Unit | `AVAILABLE → RESERVED` (reserve), `RESERVED → AVAILABLE` (expiry), `RESERVED → SOLD` (approval) | phases 3–5, conditional UPDATEs |
| Reservation | active → expired (time passes) | derived from `expires_at` |
| Contract | draft → approved (`approved_at` set once) | phase 5, `UPDATE … WHERE approved_at IS NULL` |
| Installment | unpaid → partial → paid; overdue by date | derived on read |

## Seed data (prisma/seed-data.ts)

| Item | Per company | Total |
|---|---|---|
| Company | — | 2 (Arabic names, fictional) |
| Users | 1 `MANAGER`, 1 `ACCOUNTANT`, 2 `SALES` | 8 |
| Units | 12, all `AVAILABLE`, all 4 types, 3 projects, areas 85–450 m², rooms 1–7, prices 450,000–3,200,000 SAR | 24 |
| Clients | 3 per sales rep (6), at least 1 with notes per rep | 12 |
| Reservations, contracts, installments, payments, audit rows | none (FR-030) | 0 |

Fixed UUIDs for every seed row. Accounts and the password are in [contracts/seed-accounts.md](./contracts/seed-accounts.md).

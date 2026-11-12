# Contract: Database Guarantees for Later Phases

**Feature**: `002-schema-seed`

What phases 2–7 can rely on, and what they must still do themselves. Tests assert the SQLSTATE and the
constraint name listed here (read from `error.meta.driverAdapterError.cause.originalCode` and `originalMessage`, research R8).

## Constraint catalogue

| Rule | Constraint name | SQLSTATE |
|---|---|---|
| Email unique | `users_email_key` | 23505 |
| Email normalized (lowercase, trimmed, not empty) | `users_email_normalized_check` | 23514 |
| Unit price > 0 | `units_price_check` | 23514 |
| Unit area > 0 | `units_area_check` | 23514 |
| Unit rooms ≥ 0 | `units_rooms_check` | 23514 |
| Project name trimmed, not empty | `units_project_name_check` | 23514 |
| Unit number trimmed, not empty | `units_number_check` | 23514 |
| Unit unique per company + project + number | `units_company_id_project_name_number_key` | 23505 |
| Client's sales rep in the same company | `clients_company_id_sales_rep_id_fkey` | 23503 |
| Reservation's unit in the same company | `reservations_company_id_unit_id_fkey` | 23503 |
| Reservation's client in the same company | `reservations_company_id_client_id_fkey` | 23503 |
| Reservation's sales rep in the same company | `reservations_company_id_sales_rep_id_fkey` | 23503 |
| One contract per reservation | `contracts_reservation_id_key` | 23505 |
| Contract's reservation in the same company | `contracts_company_id_reservation_id_fkey` | 23503 |
| Final price > 0 | `contracts_final_price_check` | 23514 |
| 0 ≤ down payment < final price | `contracts_down_payment_check` | 23514 |
| Installment count ≥ 1 | `contracts_installment_count_check` | 23514 |
| Installment position unique per contract | `installments_contract_id_seq_key` | 23505 |
| Installment position ≥ 0 | `installments_seq_check` | 23514 |
| Installment amount > 0 | `installments_amount_check` | 23514 |
| 0 ≤ paid amount ≤ amount | `installments_paid_amount_check` | 23514 |
| Payment amount > 0 | `payments_amount_check` | 23514 |
| Idempotency key not empty | `payments_idempotency_key_check` | 23514 |
| Idempotency key unique per contract | `payments_contract_id_idempotency_key_key` | 23505 |
| `LOGIN_FAILED` has `meta.email`, not empty, normalized | `audit_logs_login_failed_email_check` | 23514 |
| Payments: no UPDATE / DELETE / TRUNCATE | triggers `payments_no_update_delete`, `payments_no_truncate` | **AQ001** |
| Audit log: no UPDATE / DELETE / TRUNCATE | triggers `audit_logs_no_update_delete`, `audit_logs_no_truncate` | **AQ001** |
| Delete of a referenced row | any `*_fkey` | 23001 (restrict) |
| Reference to a missing row | any `*_fkey` | 23503 |

All names above were checked against the spike's generated `migration.sql` (Prisma 7.10.1).

## What later phases must do (not enforced by the database)

| Rule | Phase | How |
|---|---|---|
| Login trims and lowercases the email (`trim().toLowerCase()`) **before the user lookup** and before writing `LOGIN_FAILED` | 2 | the database stores only lowercase emails (`users_email_normalized_check`), so `Ali@x.test` would find no user; and the CHECK on `LOGIN_FAILED` rejects an un-normalized email |
| `LOGIN_FAILED` rows: `meta = { email }`, `company_id`/`user_id` set only when the email matched a user | 2 | lockout count uses the partial index on `meta ->> 'email'` |
| Allowed unit status transitions | 3–5 | conditional `UPDATE … WHERE status = …` |
| At most one active reservation per unit | 4 | conditional `UPDATE units … WHERE status = 'AVAILABLE'` |
| Client of a reservation belongs to the reserving sales rep | 4 | service check + test |
| `sales_rep_id` points to a user with role `SALES` | 3, 4 | the id always comes from the session of a `SALES` user |
| Final price ≥ ceil(unit price × 95 / 100) | 5 | service + unit test |
| Down payment + installments = final price | 5 | pure schedule function + unit tests |
| Draft editable only while `approved_at IS NULL` | 5 | condition in the UPDATE |
| Payment ≤ remaining amount; allocation oldest first | 6 | `SELECT … FOR UPDATE` on the contract, in one transaction |
| Company scoping of every query | all | every repository function takes `companyId` |

## Date and money conventions

- **Money**: `bigint` halalas in the database, `bigint` from Prisma. Repositories convert to `number` for DTOs
  (AGENTS.md §4); every seed and demo amount is far below `Number.MAX_SAFE_INTEGER`.
- **`installments.due_date`** is a Postgres `date`. Prisma maps it to a JS `Date` at **UTC midnight**. Phase 5 builds
  each due date from the Riyadh calendar day as `new Date(Date.UTC(y, m - 1, d))` and reads it back with UTC getters.
  Using the Riyadh-midnight instant would store the previous day.
- **Instants** (`expires_at`, `approved_at`, `created_at`) are `timestamptz`. "Today in Riyadh" is computed in code with `@date-fns/tz`.

## Append-only boundary

UPDATE, DELETE and TRUNCATE on `payments` and `audit_logs` fail for every connection, superusers included.
The table owner or a superuser can still disable the triggers on purpose
(`ALTER TABLE … DISABLE TRIGGER`, `session_replication_role = replica`). In the compose stack the app connects
as that owner (research R5). A least-privilege runtime role is listed under README "Not done".

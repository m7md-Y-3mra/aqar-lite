# Data Model: Login, Logout and App Shell

**Feature**: `003-auth-app-shell` | **Date**: 2026-11-12

This phase uses the phase 1 tables (`specs/002-schema-seed/data-model.md`) and adds **one CHECK constraint** in a
new migration. No table, column or index is added. Applied migrations are not edited.

## Tables used

### `users` (read only)

| Column | Use in this phase |
|---|---|
| `id`, `company_id`, `name`, `role` | Loaded with the session; `company_id` and `role` are always read fresh, never copied. |
| `email` | Login lookup. Stored trimmed + lowercase (phase 1 CHECK), so `WHERE email = normalized` is exact. Unique index. |
| `password_hash` | Argon2id PHC string; verified at login. Never selected into a DTO or a log. |

### `companies` (read only)

`name` is shown in the shell and the home page.

### `sessions` (insert, read, delete)

| Column | Rule |
|---|---|
| `id` | `sha256(token)`, lowercase hex, 64 chars (phase 1 CHECK). The raw token is never stored. |
| `user_id` | FK → `users`. |
| `expires_at` | Login time + 7 days. Never extended. A row with `expires_at <= now` is treated as no session. |

- **Create**: one row per successful login. One user may have many rows, one per device.
- **Read**: `findUnique({ id })`, including user and company; valid only if `expires_at > now`.
- **Delete**: logout runs `deleteMany({ id })`, which is idempotent: deleting a missing row is not an error.
- Expired rows are not cleaned up in the background (no scheduled jobs). They are harmless, because the token is
  checked against `expires_at` on every read.

### `audit_logs`: `LOGIN_FAILED` rows (insert, count)

Append-only (phase 1 triggers). One row per failed login with valid input.

| Column | Value |
|---|---|
| `action` | `LOGIN_FAILED` |
| `company_id` | The account's company, or `NULL` for an unknown email |
| `user_id` | The account's id, or `NULL` for an unknown email |
| `entity_id` | `NULL` |
| `meta` | `{ "email": "<trimmed lowercase>", "reason": "invalid_credentials" \| "locked" }`. Never a password. |
| `created_at` | Written explicitly from the service clock (research R6), not the DB default |

**Lock rule**: an email is locked while
`count(LOGIN_FAILED rows WHERE meta->>'email' = e AND meta->>'reason' = 'invalid_credentials' AND created_at > now − 15 min) >= 5`.
`locked` rows are never counted. The count is served by the phase 1 index
`audit_logs_login_failed_email_idx ((meta->>'email'), created_at) WHERE action = 'LOGIN_FAILED'`.

## New migration: `login_failed_reason_check`

```sql
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_login_failed_reason_check"
  CHECK ("action" <> 'LOGIN_FAILED' OR "meta" ->> 'reason' IN ('invalid_credentials', 'locked'));
```

- Created with `prisma migrate dev --create-only`, with the SQL added by hand. Prisma cannot express a CHECK.
- Why: the reason decides the lock. A wrong value written by code would silently remove the limit (research R7).
- Safe on existing data: the seed writes no audit rows, and the integration schema is rebuilt each run.

## Non-table data (code)

### Session user (server only)

`SessionUser = { userId, companyId, role, name, companyName }` (the shape agreed in docs/phases.md). Built from the session row on every request. It never
leaves the server whole.

### Shell user (DTO to the client)

`ShellUser = { name, role, companyName }` in `src/shared/components/current-user/types.ts`. This is all the shell and the home page need. No ids, no hash. The `(app)` layout passes it to `CurrentUserProvider` (a React context, docs/phases.md); it is never used for security.

### Login input (`auth.schemas.ts`)

| Field | Rule | Arabic message |
|---|---|---|
| `email` | string, trimmed, lowercased, valid email, max 254 | "أدخل بريدًا إلكترونيًا صحيحًا" |
| `password` | string, min 1, max 128, not trimmed | "أدخل كلمة المرور" / "كلمة المرور طويلة جدًا" |

The input schema has no `companyId`, `role` or any other field (constitution II). Extra keys are stripped by the
parse; only parsed values reach the service.

### Roles and navigation (`src/shared/lib`)

- `ROLES = ["MANAGER", "SALES", "ACCOUNTANT"]` and `ROLE_LABELS` (مدير، مندوب مبيعات، محاسب). A unit test checks
  that they match the Prisma enum.
- `NAV_ITEMS`: Home only in this phase. The full role map (spec FR-024) is kept as a comment for later phases.

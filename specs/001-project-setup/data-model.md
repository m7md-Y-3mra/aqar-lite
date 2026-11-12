# Data Model: Project Setup and Tooling

**Feature**: `001-project-setup`

## Database

**No tables in this phase.** `prisma/schema.prisma` declares only the generator and the PostgreSQL
datasource. Phase 1 (`Database Schema and Seed`) adds every entity and integrity rule.

| Database | Created by | Used by |
|---|---|---|
| `aqar` | `POSTGRES_DB` in `docker-compose.yml` | the app |
| `aqar_test` | `docker/db/init/01-create-test-db.sql` on the first start of an empty volume | integration tests only |

Schema state of both databases comes only from `prisma migrate deploy` (entrypoint for `aqar`,
integration global setup for `aqar_test`). With no migrations this is a no-op ("No pending migrations to apply").

## Non-database models defined in this phase

### Environment configuration

Validated once by `parseEnv()` in `src/server/env.ts`. The full list is in [contracts/environment.md](./contracts/environment.md).

- Every key is a non-empty string after trimming; empty counts as missing.
- A failure lists **all** failing keys with a reason, and never prints a value.
- Result type `Env` is read-only and cached by `getEnv()`.

### Error code catalogue

`ERROR_CODES` in `src/server/http/error-codes.ts`: code → HTTP status. `ERROR_MESSAGES` in
`src/shared/lib/error-messages.ts`: code → Arabic message, typed `Record<ErrorCode, string>`, so a missing message is a type error.
The phase 0 codes are in [contracts/api-response.md](./contracts/api-response.md). Each later phase adds its own codes in both files.

### State transitions

None in this phase.

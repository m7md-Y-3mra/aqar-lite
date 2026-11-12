# Contract: Commands

## npm scripts

| Script | Command | Needs DB |
|---|---|---|
| `dev` | `next dev` | for DB pages (none in phase 0) |
| `build` | `next build` | no |
| `start` | `next start` | yes |
| `lint` | `eslint .` | no |
| `typecheck` | `tsc --noEmit` | no (needs `db:generate` once after a fresh install) |
| `test` | `vitest run --config vitest.config.ts` | no |
| `test:integration` | `vitest run --config vitest.integration.config.ts` | yes (`docker compose up -d db`) |
| `db:migrate` | `prisma migrate dev` | yes |
| `db:seed` | `prisma db seed` | yes |
| `db:generate` | `prisma generate` | no (needs `DATABASE_URL` set, any value) |
| `format` | `prettier --write .` | no |

## docker compose up

1. `db` starts; on an empty volume it creates `aqar` and `aqar_test`. Healthy when `pg_isready` passes.
2. `app` starts only after `db` is healthy, then runs `docker/app/entrypoint.sh`:
   1. `node --conditions=react-server scripts/check-env.ts`: exits 1 with the list of bad variables.
   2. `prisma migrate deploy`
   3. `prisma db seed` (the seed skips itself when data exists)
   4. `exec next start -H 0.0.0.0 -p 3000`
3. Ports on the host: app `3000`, db `5432`.

## CI (`.github/workflows/ci.yml`)

- Trigger: `pull_request` targeting `main` (opened, synchronize, reopened). No push trigger.
- Job `lint-typecheck`: checkout → setup-node 22 (npm cache) → `npm ci` → `npx prisma generate` (only if
  `prisma/schema.prisma` exists, dummy `DATABASE_URL` on this step only) → `npm run lint` → `npm run typecheck`.
- Result: a `CI / lint-typecheck` check with pass/fail on the pull request.

# Quickstart: Validate Database Schema and Seed

**Feature**: `002-schema-seed`

**Prerequisites**: phase 0 merged into `main` and this branch rebased onto it; Docker running; `npm ci` done;
`.env` from `.env.example`.

## §1 Migrations on an empty database (SC-001)

```bash
docker compose down -v
```

```bash
docker compose up -d db
```

```bash
npx prisma migrate deploy
```

Expected: both migrations (`…_init_schema`, `…_append_only_guards`) applied, exit 0.

## §2 No drift after the raw SQL (research R3)

```bash
npx prisma migrate dev --name drift_check --create-only
```

Expected: "Already in sync" or an **empty** migration. If an empty folder was created, delete it; do not commit it.

## §3 No cascade anywhere (FR-015, research R2)

```bash
grep -riE 'cascade|set null' prisma/migrations
```

Expected: no output.

## §4 Seed, then seed again (SC-004, SC-005)

```bash
npm run db:seed
```

```bash
npm run db:seed
```

Expected: the first run creates the data; the second prints "seed data already present" and changes nothing.

Atomicity (a failed seed leaves nothing behind) is proved by the integration test
`tests/integration/prisma/seed.test.ts` › "a seed that fails midway leaves no rows" (§6).

```bash
docker compose exec db psql -U aqar -d aqar -c "select (select count(*) from companies) c, (select count(*) from users) u, (select count(*) from units where status='AVAILABLE') un, (select count(*) from clients) cl, (select count(*) from reservations) r"
```

Expected: `c=2, u=8, un=24, cl=12, r=0`. Repeat after the second seed run: same numbers.

## §5 Append-only by hand (SC-003)

Run this on the **test** database: the probe row can never be deleted, and `aqar_test` is rebuilt on every integration run.
Run §6 first so `aqar_test` is migrated.

```bash
docker compose exec db psql -U aqar -d aqar_test -c "insert into audit_logs (action, meta) values ('LOGIN_FAILED', '{\"email\":\"probe@x.test\"}')" -c "update audit_logs set meta = '{}'" -c "delete from audit_logs" -c "truncate audit_logs"
```

Expected: the INSERT succeeds; UPDATE, DELETE and TRUNCATE each fail with `ERROR: append-only table audit_logs: … is not allowed`.

## §6 Automated proof (SC-002, SC-003, SC-005, SC-007)

```bash
npm run test:integration
```

Expected: all tests in `tests/integration/prisma/` pass (see the proof map in [plan.md](./plan.md)).

```bash
npm run lint && npm run typecheck && npm run test
```

Expected: all pass, including `tests/unit/prisma/seed-data.test.ts`.

## §7 Full stack (phase 0 entrypoint)

```bash
docker compose down -v && docker compose up --build
```

Expected: the app log shows migrations applied and the seed run once; a restart (`docker compose restart app`) shows the seed skipped.

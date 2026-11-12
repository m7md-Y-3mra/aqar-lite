# Quickstart: Validate Phase 0

Prerequisites: Git, Docker with Compose v2. For §5–§6 also Node 22 and npm.
Commands and contracts: [contracts/commands.md](./contracts/commands.md), [contracts/environment.md](./contracts/environment.md).

## §1 Clean clone starts with one command (FR-001–004, FR-007, SC-001)

```bash
git clone <repo> aqar-lite && cd aqar-lite
docker compose down -v   # only if an old stack exists
docker compose up --build
```

Expected:
- `db` becomes healthy; `app` starts after it.
- App log shows: env check OK → "No pending migrations to apply" → seed ran → Next.js "Ready".
- `curl -s http://localhost:3000 | grep -o '<html[^>]*>'` contains `lang="ar"` and `dir="rtl"`.
- `curl -sI http://localhost:3000` shows `content-security-policy`, `x-frame-options`,
  `x-content-type-options`, `referrer-policy`, and no `x-powered-by`.
- `docker image inspect $(docker compose images -q app) --format '{{json .Config.Env}}'` does **not** contain `DATABASE_URL` (the build-time dummy is not left in the image).
- `docker compose exec db sh -c 'echo $PGDATA'` prints `/var/lib/postgresql/18/docker`, and `docker volume ls` shows the named `db-data` volume (no extra anonymous volume).

## §2 Second start (FR-002, SC-002)

`Ctrl+C`, then `docker compose up` again. Expected: no errors, no new init SQL run, app ready.

## §3 Layout (FR-003)

Open `http://localhost:3000` at phone width (375 px) and desktop width. Expected: Arabic text, right-aligned, no horizontal scroll.

## §4 Missing setting refuses to start (FR-013, SC-005)

```bash
docker compose run --rm -e APP_ORIGIN= app
```

Expected: exit code 1, message lists `APP_ORIGIN`, no secret values printed, Next.js never starts.

## §5 Layer rules (FR-010, FR-011)

- Create `src/features/demo/server/demo.service.ts` containing `import { PrismaClient } from "@/generated/prisma/client";`
  → `npm run lint` fails and names the file. Delete it → lint passes.
- Create a `"use client"` component in `src/shared/components/demo/demo.tsx` importing `@/server/db`
  → `npm run lint` fails. With the lint error ignored, `npm run build` also fails on `server-only`. Delete it.

## §6 Quality gates (FR-015–018, SC-003)

```bash
npm ci
cp .env.example .env
npm run db:generate
npm run lint && npm run typecheck && npm run test
docker compose up -d db
npm run test:integration
```

Expected: all pass. Then `docker compose stop db` and run `npm run test` again: it still passes (no DB).
`npm run test:integration` now fails with "Test database not reachable … run `docker compose up -d db`".

## §7 Pull request check (FR-020, FR-021, SC-006)

After pushing to GitHub: open a PR to `main`. Expected: `CI / lint-typecheck` appears and passes.
Push a commit with a lint error: the check fails. Revert: it passes.

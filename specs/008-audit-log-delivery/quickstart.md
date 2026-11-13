# Quickstart: Audit Log, Hardening and Delivery

Validation and delivery steps for phase 7. Run from the worktree root unless a step says otherwise.

## 1. Setup (isolated test database)

Other worktrees share the database on `127.0.0.1:5433`, and integration tests wipe `aqar_test`. Use a separate
database for this worktree:

```bash
npm ci
DB_HOST_PORT=5434 docker compose -p aqar-delivery up -d db
DATABASE_URL=postgresql://aqar:aqar@localhost:5434/aqar npx prisma generate
```

`npm ci` is required first: this worktree's `node_modules` is older than `package-lock.json`.

## 2. Automated checks (FR-024)

```bash
npm run lint && npm run typecheck && npm run test
TEST_DATABASE_URL=postgresql://aqar:aqar@localhost:5434/aqar_test npm run test:integration
```

Expected: all pass. New tests: `tests/unit/features/audit-log/**`, `tests/integration/features/audit-log/**`, and the
updated `tests/unit/shared/lib/navigation.test.ts` (see the rule → test map in [plan.md](./plan.md)).

## 3. Audit log by hand (FR-009 – FR-014)

Start the app on the isolated DB (`DATABASE_URL=…5434/aqar npm run db:migrate && npm run db:seed && npm run dev`,
with `APP_ORIGIN` from `.env.example`), or use the clean-clone stack from §5.

1. Log in with a wrong password for `sales1@ufuq.test`. Failed logins with an unknown email are never listed, so
   markup in a typed email can only reach the screen through a known account's email; the plain-text rule is covered
   by `conventions.test.ts` (no `dangerouslySetInnerHTML`) and React text rendering.
2. As `manager@ufuq.test`: change an available unit's price.
3. As `sales1@ufuq.test`: reserve a unit, create a draft contract.
4. As `accountant@ufuq.test`: approve it, record a partial payment that covers the down payment and part of
   installment 1.
5. As `manager@ufuq.test`: open **سجل التدقيق**.
   - Newest first. Each type has its own badge color and Arabic name.
   - Time is Riyadh time. The user column shows the actor's name, or the typed email for a failed login.
   - Price change: old and new price in riyals, link to the unit. Approval: unit price, final price, down payment,
     installment count, start date, link to the contract. Payment: amount, "الدفعة المقدمة" and "القسط 1" with the
     applied amounts, remaining after, link to the contract. Failed login: reason.
   - Typed text shows as text; nothing runs.
   - Loading skeleton on first load (throttle the network), error state with retry (stop the DB), empty state
     (a company with no events: log in as `manager@nukhba.test` on a fresh seed).
   - Mobile width (375 px): the table scrolls inside its card; the page does not scroll sideways.
6. As `accountant@ufuq.test` and `sales1@ufuq.test`: no nav item; `/audit-log` redirects to `/`;
   `GET /api/audit-log` → 403. Logged out → 401.
7. As `manager@nukhba.test`: none of Ufuq's events are listed.

## 4. Delivery checks (FR-017 – FR-019, FR-025)

```bash
npm audit
```

Expected: `0 high`, `0 critical`. Do not run `npm audit fix` (research R8).

```bash
git log --all -p | grep -nE -- '-----BEGIN [A-Z ]*PRIVATE KEY|AKIA[0-9A-Z]{16}|gh[po]_[A-Za-z0-9]{20,}|sk_live|xox[bp]-|postgres(ql)?://[^:]+:[^@]+@' | grep -vE 'aqar:aqar@|ci:ci@' | head
```

Expected: no output.

```bash
git log --all --diff-filter=A --name-only --format= | grep -E '(^|/)\.env($|\.)' | sort -u
```

Expected: only `.env.example`.

Then compare every variable read in `src/server/env.ts`, `prisma.config.ts`, the vitest configs and
`docker-compose.yml` with `.env.example`. Expected: `DATABASE_URL`, `APP_ORIGIN`, `LOG_LEVEL`, `TEST_DATABASE_URL`,
`DB_HOST_PORT` are all listed.

Run `/security-review` on the branch. Fix each finding, or record it in README "Security" as a known limit.

## 5. Clean clone (FR-015, FR-016, SC-001)

After the last code commit:

```bash
docker ps
```

Stop every other stack of this project that uses ports 3000 or 5433 (`docker compose -p <name> down`, no `-v`).

```bash
git clone -b claude/speckit-delivery-system-949ad7 /home/m7md/a/aqar-lite ~/aqar-clean-check
```

```bash
docker compose -p aqar-clean up --build
```

Run the second command inside `~/aqar-clean-check`. Expected: the DB starts, migrations and seed run, and the app
answers on http://localhost:3000. Do the full flow from §3 with the README's seed accounts. Then stop it, run
`docker compose -p aqar-clean up` again, and confirm the data is still there and no duplicate seed rows exist.
Afterwards: `docker compose -p aqar-clean down -v` and delete `~/aqar-clean-check`.

## 6. README check (FR-020 – FR-023)

Read README.md and tick each item:

- [ ] Running from a clean machine (one command, ports, volume reset)
- [ ] Seed accounts per role, both companies, password
- [ ] Technical decisions: each with what, why, rejected alternative
- [ ] Assumptions, including the phase 7 block
- [ ] Security: the 3 biggest risks (IDOR, privilege escalation / mass assignment, duplicated money operations), each with how it is handled and the proving test; dependency audit result
- [ ] How company isolation is guaranteed (with test file paths)
- [ ] Not done: audit-log filters, Playwright E2E, tests in CI, each with how it would be built; no "remains for the last phase" text
- [ ] AI tools
- [ ] Opening paragraph describes the finished system

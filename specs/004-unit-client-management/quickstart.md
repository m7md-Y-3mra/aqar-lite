# Quickstart: Validate Units and Clients

## Prerequisites

- Phases 1 and 2 are merged, and this branch includes them.
- Docker running; dependencies installed (`npm ci`); Prisma client generated (`npm run db:generate` with `DATABASE_URL` set).
- Seed accounts: see README › Seed accounts. Password `AqarLite#2026`.
  - Company A (الأفق): `manager@ufuq.test`, `accountant@ufuq.test`, `sales1@ufuq.test`, `sales2@ufuq.test`
  - Company B (النخبة): `manager@nukhba.test`, …

## 1. Automated checks

```bash
npm run lint && npm run typecheck && npm run test
```

```bash
docker compose up -d db
```

```bash
npm run test:integration
```

**Expected**: everything passes. The integration run applies the new `client_text_checks` migration to `aqar_test` and runs the units and clients service and route tests. Rule-to-test mapping: [plan.md › Requirement → proof map](./plan.md#requirement--proof-map).

## 2. Roles and hidden actions (FR-024, FR-025, FR-030)

Start the app (`docker compose up`), then log in as each user of company A:

| User | /units | /units/new | Edit unit | /clients | /clients/new | Edit client |
|---|---|---|---|---|---|---|
| manager | list + "إضافة وحدة" | form | yes | all clients, owner column | redirected | no edit link |
| sales1 | list, no add button | redirected | no edit link | own clients + "إضافة عميل" | form | own only |
| accountant | list, no add button | redirected | no edit link | all clients, owner column | redirected | no edit link |

Then check the server refuses the same actions without the UI. Use the browser dev tools with an accountant session:

```js
fetch("/api/units", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).then(r => r.status)
```

**Expected**: `403`.

## 3. Filters, sort, pages in the URL (FR-002–FR-005)

1. As any user on `/units`, filter status "متاحة" and a price range of 400,000–600,000 SAR, then sort by area descending.
   **Expected**: the URL holds `status=AVAILABLE&minPrice=40000000&maxPrice=60000000&sort=area&order=desc`, and refreshing shows the same rows.
2. Open `/units?pageSize=2`, then move to page 2.
   **Expected**: no unit is repeated.
3. Open `/units?pageSize=51` and `/units?minPrice=9&maxPrice=1`.
   **Expected**: an error state with a "reset filters" link, not a 500.

## 4. States and form errors (FR-027, FR-028)

1. Filter to a price range with no units.
   **Expected**: the empty state.
2. Stop the database (`docker compose stop db`) and reload `/units`.
   **Expected**: the error state with retry.
3. With slow network throttling, open `/units`.
   **Expected**: a skeleton, then rows.
4. As the manager, submit `/units/new` with an empty project name, area 0 and price `10.555`.
   **Expected**: each error appears under its field. Then submit an existing project + number.
   **Expected**: an error under the unit number field.
5. As the manager, open the edit form of an available unit. In another tab, mark it reserved (as sales1 after phase 4, or with SQL), then change the price and save.
   **Expected**: the "لا يمكن تغيير سعر وحدة محجوزة أو مباعة" alert at the top, and the price field becomes read-only.

## 5. Notes are plain text (FR-019)

As sales1, create a client with notes `<b>مهم</b>` on a first line and `<script>alert(1)</script>` on a second line.

**Expected**: the client page shows both lines literally, with the line break kept. No bold text and no alert.

## 6. Company isolation by URL (FR-022, FR-023)

1. As `manager@ufuq.test`, open `/units/<a company-B unit id>/edit` and `/clients/<a company-B client id>`.
   **Expected**: the 404 page.
2. As `sales2@ufuq.test`, open `/clients/<a sales1 client id>`.
   **Expected**: 404.

## 7. Mobile and RTL (FR-029)

Check `/units`, `/units/new`, `/clients` and `/clients/<id>` at 375 px and at desktop width.

**Expected**:
- Arabic text, right-to-left.
- The table scrolls inside its own container; the page itself has no horizontal scroll.
- Forms take the full width.

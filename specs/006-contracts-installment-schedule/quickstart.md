# Quickstart: Contracts and Installment Schedule

How to check that phase 5 works. API shapes are in [contracts/contracts-api.md](./contracts/contracts-api.md); rules are in [data-model.md](./data-model.md).

## 0. Prerequisites

- Phase 4 (reservations) is merged into `main`, and this branch is rebased onto it.
- Start the database and apply migrations, including `<timestamp>_contracts_guards`:

```bash
docker compose up -d db
```

```bash
npx prisma migrate dev
```

- Seed accounts are listed in the README. Each company has a manager, an accountant and two sales reps.

## 1. Automated checks

```bash
npm run lint && npm run typecheck && npm run test
```

```bash
npm run test:integration
```

Expected:
- Unit: `tests/unit/features/contracts/domain/*.test.ts` pass. They cover 31 January, a leap-year February, 100,000 over 3, a down payment of 0, the sum invariant, the minimum price, status rules, and the Riyadh date at 22:00 UTC.
- Integration: `contracts.service.test.ts`, `contracts.routes.test.ts`, `contracts.repository.test.ts` and `prisma/contracts-guards.test.ts` pass. The phase 3 and phase 4 suites still pass.

## 2. Create a draft with a preview (sales rep)

1. Log in as sales rep 1 of company A. Reserve an available unit for one of your clients (phase 4).
2. Open **الحجوزات** and click **إنشاء عقد** on that reservation.
3. Expect:
   - the unit, client, unit price, and "أقل سعر مسموح" (95% rounded up to the halala);
   - with final price 100,000, down payment 0 and 3 installments, the preview shows 33,333 / 33,333 / 33,334, total 100,000, dates one, two and three months from today;
   - the label "التواريخ تقديرية، وتُثبَّت عند الاعتماد".
4. Type a final price below the minimum: an error appears next to the field, and save is refused.
5. Set a down payment ≥ the final price, or 3 installments over 2 riyals: an error appears next to the field.
6. Save. You land on the contract page with status **مسودة**. The unit is still **محجوزة** in the units list. The reservation row now shows **عرض العقد**.

## 3. Edit the draft

1. On the contract page, click **تعديل**. Change the installments to 6 and save. The page shows 6 lines.
2. As sales rep 2, open the same contract URL: you see the not-found page.

## 4. Approve (accountant)

1. Log in as the accountant of company A. Open **العقود**: you see the draft (drafts first).
2. Open it. In another browser, as sales rep 1, change the final price and save.
3. Back as the accountant, click **اعتماد**. Expect the message "تم تعديل العقد بعد أن فتحته…", and the page refreshes to the new values.
4. Click **اعتماد** again. Expect:
   - status **معتمد**, start date today (Saudi time);
   - the schedule with real dates and no "estimated" label, each line **غير مدفوع**, and remaining = final price;
   - the unit is **مباعة** in the units list;
   - the reservation is gone from the active reservations list.
5. As sales rep 1, open the contract: there is no **تعديل** button. A `PATCH` by hand returns 409 `CONTRACT_ALREADY_APPROVED`.
6. In the DB, an `UPDATE contracts SET final_price = 1 WHERE id = '<id>'` fails, because of the trigger.

## 5. Expired reservation

1. Make a draft, then move its reservation's expiry into the past:

   ```sql
   UPDATE reservations SET expires_at = now() - interval '1 minute' WHERE id = '<id>';
   ```

2. Expect:
   - the contracts list marks it **انتهى الحجز**;
   - the contract page offers neither edit nor approve;
   - a direct approve or edit returns 409 `RESERVATION_EXPIRED`;
   - the unit is **متاحة** again in the units list.

## 6. Roles and tenants

- Manager of company A: sees every contract of A, read-only. Calls to create, edit or approve → 403.
- Accountant of company B: opening company A's contract URL shows not-found. A direct approve → 404.
- Sales rep: sees only their own contracts.

## 7. States and layout

- Throttle the network: lists and pages show skeletons. Stop the server: error state with retry. A new company with no contracts: empty state.
- At 375 px width, the form, the preview and the schedule table are readable and scroll inside their card, with no page-level horizontal scroll.
- All text is Arabic, right-to-left.

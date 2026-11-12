# Quickstart: Validate Unit Reservations

**Prerequisites**:
- Phases 2 and 3 are merged into `main`, and this branch is rebased onto it.
- The seed accounts and password are in the README. Use company "الأفق": `sales1@ufuq.test`, `sales2@ufuq.test`, `manager@ufuq.test`, `accountant@ufuq.test`, plus one company "النخبة" account.

## 1. Automated proof

```bash
docker compose up -d db
npm run lint && npm run typecheck && npm run test
npm run test:integration
```

Expected: all green. The integration run includes the tests named in the [plan's proof map](./plan.md#requirement--proof-map), in particular:
- `reservations.service.test.ts` › "concurrency › two reps, one available unit: exactly one wins" (×10)
- "concurrency › two reps, one just-expired unit: exactly one wins" (×10)
- "concurrency › release during an open reserve never frees the unit"
- "expiry › expired reservation frees the unit and another rep can reserve it"
- "ownership › rep cannot reserve for another rep's client"
- `tests/integration/prisma/reservation-overlap-guard.test.ts` › "rejects an overlapping reservation for the same unit"

## 2. Reserve as a sales rep (Story 1)

1. Log in as `sales1@ufuq.test` and open "الوحدات".
2. **Expected**: every AVAILABLE row has "حجز". RESERVED and SOLD rows do not.
3. Click "حجز".
4. **Expected**: the URL gains `?reserve=<id>`, and a dialog opens showing the unit and a select with only sales1's clients.
5. Pick a client and confirm.
6. **Expected**:
   - a toast with the expiry date and time;
   - the dialog closes and `reserve` leaves the URL;
   - the row now shows "محجوزة" with an expiry 72 hours from now in Saudi time, and no client or rep name.
7. Press the browser back button. **Expected**: the dialog does not reopen (`router.replace`).

## 3. Lose the race (Story 1, scenario 4, by hand)

1. Open two browsers: `sales1` and `sales2`.
2. Both open the dialog for the same AVAILABLE unit.
3. sales1 confirms first, then sales2 confirms.
4. **Expected**:
   - sales2 sees "هذه الوحدة لم تعد متاحة، فقد حُجزت للتو. اختر وحدة أخرى." at the top of the form;
   - after closing the dialog, the row shows "محجوزة".

## 4. Expiry with no manual action (Story 2)

1. Make one reservation look old:
   ```bash
   docker compose exec db psql -U postgres -d aqar -c "UPDATE reservations SET reserved_at = now() - interval '73 hours', expires_at = now() - interval '1 hour' WHERE id = '<id>';"
   ```
   Adjust the user and database names to the compose file.
2. Reload "الوحدات" as any user. **Expected**: the unit shows "متاحة", and "الحجوزات" no longer lists the reservation.
3. As `sales2`, reserve the same unit. **Expected**: it succeeds with a new 72-hour expiry.

## 5. Lists per role (Stories 3 and 4)

| Log in as | Open "الحجوزات" | Expected |
|---|---|---|
| sales1 | nav item visible | only sales1's active reservations, soonest first, expiry in Saudi time + time left, no rep column |
| manager@ufuq | nav item visible | both reps' reservations, rep column shown, none from "النخبة" |
| accountant@ufuq | nav item hidden; `/reservations` by address | redirected to the home page; `GET /api/reservations` → 403 |
| sales1, no reservations | page | empty state with a link to the units list |

Then stop the DB container and reload. **Expected**: the error state with "إعادة المحاولة".

## 6. Server checks by hand (FR-001, FR-003, FR-006, FR-007)

From the browser console of a logged-in session, `fetch("/api/reservations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({...}) })` with:

| Logged in as | Body | Expected |
|---|---|---|
| manager / accountant | valid unit + client | 403 |
| sales1 | sales2's client | 404; unit still "متاحة" |
| sales1 | a unit id from "النخبة" | 404 |
| sales1 | valid + `"expiresAt": "2030-01-01", "salesRepId": "<sales2>"` | 201; expiry is now + 72 h; rep is sales1 |
| sales1 | `{ "unitId": "x" }` | 400 with `fieldErrors.unitId` and `fieldErrors.clientId` |

## 7. Layout

- At 375 px and 1280 px: no horizontal scroll, RTL, the dialog fits the screen, and the reservations table scrolls inside its own container if needed.
- The dialog works by keyboard: Tab, Enter and Escape.

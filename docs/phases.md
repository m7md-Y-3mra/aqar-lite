## Phase 1 — Foundation and Authentication

**Clarify focus:** session length, seed content, which nav items each role sees.

```
/speckit.specify
Build the foundation of "Aqar Lite" (see docs/brief.md sections 1, 2, 3.1 and 4).
Aqar Lite is one system used by many real-estate development companies (multi-tenant).
Every user belongs to exactly one company and has exactly one role: manager, sales rep or accountant.

User stories:
- As a staff user, I log in with email and password and reach the app home page.
- As a staff user, I log out, and my session stops working on the server, not only in my browser.
- As a visitor who is not logged in, I am sent to the login page. API calls without a valid session get 401.

Rules:
- There is no sign-up, no user management screen and no password reset.
- A wrong email and a wrong password show the same message. The response time must not reveal if the email exists.
- After 5 failed logins for one email within 15 minutes, login for that email is blocked for 15 minutes, with the same generic message.
- Every failed login is written to the audit log.
- The app shell is Arabic and RTL. It works on mobile and desktop. The navigation shows only items the user's role can use.

Scope includes the full data model for all later phases (units, clients, reservations, contracts, installments, payments, audit log), with all integrity rules, so later phases do not need schema changes.

Seed data:
- 2 companies. Each has 1 manager, 1 accountant and 2 sales reps.
- Each company has at least 10 available units with different types, prices and areas, and at least 3 clients per sales rep.
- The README lists every seed account with its role.

Done when:
- `git clone` then `docker compose up` starts the database, runs migrations and seed, and starts the app on a clean machine.
- A test proves logout makes the old session token unusable.
- A test proves the 6th failed login within 15 minutes is blocked.
```

---

## Phase 2 — Units and Clients

**Clarify focus:** can the accountant view clients (read-only)? Allowed unit types. Phone format (keep it loose).

```
/speckit.specify
Add unit and client management (see docs/brief.md sections 2, 3.2 and 3.3).

User stories — units:
- As any staff user, I see the list of my company's units. I can filter by status and by price range, sort by price or area, and move between pages.
- As a manager, I add a unit with: project name (free text), unit number, type, area, rooms and price.
- As a manager, I edit a unit. I can change its price only while the unit is available.

User stories — clients:
- As a sales rep, I add a client with name, phone and free-text notes, and I edit my clients.
- As a sales rep, I see only my own clients.
- As a manager, I see all clients of my company.
- The client page shows the notes as plain text.

Rules:
- Filtering, sorting and pagination happen on the server. All query parameters are validated; invalid values return 400.
- A unit has 3 statuses: available, reserved, sold. Nobody can set the status directly; it changes only through reservation, expiry and approval (later phases).
- Changing the price of a reserved or sold unit is refused.
- Every price change is written to the audit log with the old and the new price.
- Project name + unit number is unique inside a company.
- Sales reps and accountants cannot add or edit units. Accountants cannot edit clients.
- A unit or client from another company returns 404.

Done when:
- Integration tests prove: a user of company A cannot read or edit units or clients of company B; a sales rep cannot read another rep's client; the price of a reserved unit cannot change.
- The units list has loading, empty and error states, and form errors show next to each field.
```

---

## Phase 3 — Reservations

**Clarify focus:** can a client have more than one active reservation? Where does the rep see his reservations?

```
/speckit.specify
Add unit reservations (see docs/brief.md sections 2 and 3.4).

User stories:
- As a sales rep, I reserve an available unit for one of my own clients.
- As a sales rep, I see my active reservations and when each one expires.
- As a manager, I see all active reservations in my company.

Rules:
- A reservation is valid for 72 hours from the moment it is created.
- After 72 hours, if no contract was approved, the unit is available again with no manual action. Any page or action that reads units must show the correct status, even if nobody opened the system for days.
- A unit can have at most one active reservation.
- When two sales reps reserve the same unit at the same moment, exactly one succeeds. The other gets a clear Arabic message that the unit was just reserved (HTTP 409).
- A sales rep cannot reserve for a client who belongs to another rep.
- Only sales reps can reserve. Reservations cannot be cancelled by hand (out of scope).

Done when:
- A test sends two reservation requests for the same unit in parallel and proves only one succeeds.
- A test proves an expired reservation makes the unit available again.
- A test proves a rep cannot reserve for another rep's client.
```

---

## Phase 4 — Contracts and Installment Schedule

**Clarify focus:** minimum and maximum number of installments. Can the down payment be 0?

```
/speckit.specify
Add contracts and the installment schedule (see docs/brief.md sections 2 and 3.5).

User stories:
- As a sales rep, I create a draft contract from my active reservation. I enter the final price, the down payment and the number of monthly installments, and I see a preview of the schedule before I save.
- As a sales rep, I edit my draft while it is not approved yet.
- As an accountant, I see all contracts of my company and I approve a draft.
- As any allowed user, I open a contract and see its schedule: each installment with due date, amount, paid amount and status, and the remaining amount of the contract.

Rules:
- A reservation can have only one contract.
- The final price cannot be lower than 95% of the unit price (maximum discount 5%). Round the minimum up to the next halala.
- The down payment is less than the final price. The number of installments is at least 1.
- Installments are in whole riyals. Any remainder goes to the last installment. Down payment + installments = final price exactly.
- The down payment is installment number 0, due on the approval date. If the down payment is 0, there is no installment 0.
- The contract starts on the approval date (Asia/Riyadh). Installment i is due i months after the start date. If that day does not exist in the month, it is due on the last day of that month. Always count from the start date, never from the previous installment.
- Approval is refused if the reservation has expired.
- Approval checks that the draft did not change after the accountant opened it. If it changed, approval is refused with a clear message.
- Approval, in one transaction: the contract becomes approved, the unit becomes sold, the schedule is created, and the approval is written to the audit log. If one step fails, nothing changes.
- An approved contract cannot be edited.
- Installment status is shown as: unpaid, partial, paid or overdue. Overdue means the due date has passed (Asia/Riyadh) and it is not fully paid.
- Only the sales rep who owns the reservation creates and edits the draft. Only accountants approve. Sales reps see only their own contracts.

Done when:
- Unit tests cover: 31 January start, a leap year February, rounding (for example 100,000 over 3), down payment 0, and the sum always equal to the final price.
- An integration test proves approval is all-or-nothing, and that an approved contract cannot be edited.
```

---

## Phase 5 — Payments

**Clarify focus:** can a sales rep see payments on his own contracts (read-only)? Is a payment date entered or always today?

```
/speckit.specify
Add payments (see docs/brief.md sections 2 and 3.6).

User stories:
- As an accountant, I record a payment of any amount on an approved contract.
- As an accountant or manager, I see the payments of a contract and how the schedule changed.

Rules:
- A payment is allocated to the oldest unpaid installments first (installment 0 first). Each installment becomes partial or paid.
- A payment cannot be more than the remaining amount of the contract. A larger amount is refused with a clear message.
- Clicking "Save" twice or resending the request after a network failure must not create two payments. The same request returns the same result.
- Two accountants recording payments on the same contract at the same moment must never pay more than the remaining amount.
- A recorded payment cannot be edited or deleted by anyone, even directly in the database.
- Every payment is written to the audit log, including how it was allocated to installments.
- Only accountants record payments. Payments on contracts of another company return 404.

Done when:
- Unit tests cover: a partial payment, a payment that covers several installments, and an exact final payment.
- Integration tests prove: a repeated request with the same key creates one payment; overpayment is refused; a sales rep cannot record a payment.
```

---

## Phase 6 — Audit Log, Hardening and Delivery

**Clarify focus:** which filters the audit log page needs (keep it minimal).

```
/speckit.specify
Finish the system for delivery (see docs/brief.md sections 2, 4, 5 and 6).

User stories:
- As a manager, I read my company's audit log: failed logins, price changes, contract approvals and payments, newest first, with pages.
- As a reviewer, I clone the repository on a clean machine, run `docker compose up`, and use the system with the seed accounts.

Rules:
- Only managers can read the audit log. Nobody can edit or delete it.
- Basic HTTP security headers are set on every response.
- `npm audit` shows no high or critical vulnerabilities.
- No secrets in the repository or its git history. `.env.example` lists every variable.
- The README has: how to run, seed accounts per role, technical decisions (what, why, rejected alternative), assumptions, the 3 main security risks and how each is handled, what is not done and how it would be done, and where AI tools were used.

Extra (only if everything above is done and all tests pass):
- One Playwright E2E test for: reservation, then contract, then approval, then payment.
- GitHub Actions running lint, typecheck and tests.

Done when:
- A fresh clone in a new folder starts with `docker compose up` and the full flow works by hand with the seed accounts.
- All tests pass, and `/security-review` shows no open issues.
```

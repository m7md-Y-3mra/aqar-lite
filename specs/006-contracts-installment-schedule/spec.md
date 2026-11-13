# Feature Specification: Contracts and Installment Schedule

**Feature Branch**: `claude/contracts-installment-schedule-699d4a`

**Created**: 2026-11-13

**Status**: Draft

**Input**: User description: "Add contracts and the installment schedule (see docs/brief.md sections 2 and 3.5). User stories: As a sales rep, I create a draft contract from my active reservation. I enter the final price, the down payment and the number of monthly installments, and I see a preview of the schedule before I save. As a sales rep, I edit my draft while it is not approved yet. As an accountant, I see all contracts of my company and I approve a draft. As any allowed user, I open a contract and see its schedule: each installment with due date, amount, paid amount and status, and the remaining amount of the contract. Rules: A reservation can have only one contract. The final price cannot be lower than 95% of the unit price (maximum discount 5%). The down payment is less than the final price. The number of installments is at least 1. Down payment + installments = final price exactly. The down payment is due on the approval date. If the down payment is 0, there is nothing due on that day. A contract that starts on 31 January has its next installment due in February (at the end of February). Approval is refused if the reservation has expired. Approval checks that the draft did not change after the accountant opened it. If it changed, approval is refused with a clear message. On approval, the contract becomes approved, the unit becomes sold and the schedule is created, all together or not at all. An approved contract cannot be edited. Installment status is shown as: unpaid, partial, paid or overdue. Only the sales rep who owns the reservation creates and edits the draft. Only accountants approve. Sales reps see only their own contracts. Done when: Unit tests cover: 31 January start, a leap-year February, rounding (100,000 over 3), down payment 0, and the sum always equal to the final price. An integration test proves approval is all-or-nothing, and that an approved contract cannot be edited."

> **Note on numbering**: This is phase 5 in `docs/phases.md`. The folder is `006-…` because `005` is used by phase 4 (`005-unit-reservations`) on its own branch, which is not merged into `main` yet.

> **Dependency**: This branch was cut from `main`, which does not have phase 4 (reservations, the reservations page, and the release of expired reservations that is safe under concurrent requests). Contracts are created only from an active reservation, so phase 4 must be merged into `main`, and this branch rebased onto it, before `/speckit-implement` (constitution, Development Workflow: a phase starts only when the previous phase is merged). The plan may be written now.

## Clarifications

### Session 2026-11-13

- Q: What is the highest number of monthly installments a draft may have (docs/phases.md clarify focus for this phase)? → A: 120 months. The brief sets only a minimum of 1; 120 is a safety bound against huge inputs and one constant if it needs to change.
- Q: May a sales rep set a final price above the unit price? → A: Yes, up to the global limit of 1,000,000,000 riyals. The brief sets only a floor (at most 5% discount). Control: only an accountant approves, after comparing the values, and the approval audit row records both the unit price and the final price.
- Q: What should the preview and the draft contract page show for due dates? → A: Estimated calendar dates from the same schedule function used at approval, with today (Asia/Riyadh) as the start date, under the label "التواريخ تقديرية، وتُثبَّت عند الاعتماد". After approval, the stored dates are shown with no label.
- Q: Which status filter should the contracts list have? → A: No filter. The list shows drafts first, then approved contracts; a draft whose reservation expired is marked "reservation expired" in the list.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sales rep creates a draft contract from their active reservation, with a schedule preview (Priority: P1)

A sales rep opens their reservations page and chooses "create contract" on one of their active reservations that has no contract yet. A form shows the unit (project name, number), the client, the unit price and the lowest allowed final price. The rep enters the final price, the down payment and the number of monthly installments. While typing, the rep sees a preview of the schedule: the down payment line (when it is above 0) and each monthly installment with its amount and its estimated due date, plus the total, which always equals the final price. The rep saves, and a draft contract is created. Nothing is due and the unit is not sold yet.

**Why this priority**: The contract is the second step of the sales flow, and approval (Story 3) and payments (phase 6) need it. The schedule rules (exact total, whole-riyal installments, end-of-month dates) are named in the brief and are judged for financial accuracy.

**Independent Test**: Log in as a sales rep with an active reservation, open "create contract", enter a final price of 100,000 riyals, a down payment of 0 and 3 installments, and confirm the preview shows 33,333 / 33,333 / 33,334 riyals with a total of 100,000. Save and confirm a draft exists for that reservation and the unit is still reserved.

**Acceptance Scenarios**:

1. **Given** a sales rep with an active reservation that has no contract, **When** they enter a valid final price, down payment and installment count and save, **Then** a draft contract is created for that reservation, the rep is taken to the contract page, and the unit stays "reserved".
2. **Given** the create form, **When** the rep changes any of the three values, **Then** the preview updates without saving, shows each line with its amount and its estimated due date, and shows a total equal to the final price. The schedule carries the label "التواريخ تقديرية، وتُثبَّت عند الاعتماد" (the dates are estimated as if the contract were approved today, and are fixed on approval).
3. **Given** a unit price of 500,000 riyals, **When** the rep enters a final price below 475,000 riyals, **Then** the save is refused with a message next to the final price field that names the lowest allowed price.
4. **Given** a unit price whose 95% has a fraction of a halala, **When** the system computes the lowest allowed final price, **Then** it rounds up to the next whole halala, so the discount never exceeds 5%.
5. **Given** a down payment equal to or above the final price, **When** the rep saves, **Then** it is refused with a message next to the down payment field.
6. **Given** an installment count of 0, a fraction, or above the maximum, **When** the rep saves, **Then** it is refused with a message next to the installment count field.
7. **Given** values where the amount left after the down payment is less than 1 riyal per installment (for example 2 riyals left over 3 installments), **When** the rep saves, **Then** it is refused with a message next to the installment count field, because every installment must be at least 1 riyal.
8. **Given** a reservation that already has a contract (draft or approved), **When** the rep tries to create another contract for it, **Then** it is refused as a conflict (409) with a clear Arabic message, and the existing contract does not change.
9. **Given** a reservation whose 72 hours have passed, **When** the rep tries to create a contract for it, **Then** it is refused with a clear Arabic message that the reservation expired, and nothing is saved.
10. **Given** a reservation made by another sales rep of the same company, or a reservation of another company, **When** a rep tries to create a contract for it (through the UI or by calling the server directly), **Then** it is refused as "not found" (404).
11. **Given** a logged-in manager or accountant, **When** they try to create a contract by calling the server directly, **Then** it is refused as "not allowed" (403), and the action is not shown to them.
12. **Given** a sales rep, **When** they send by hand an approval date, a company, a sales rep, a unit, a client, a status or a schedule together with the contract, **Then** those values are ignored. Only the reservation, the final price, the down payment and the installment count are read.

---

### User Story 2 - Accountant approves a draft; contract, unit and schedule change together (Priority: P1)

An accountant opens the contracts page, sees every contract of their company, and opens a draft. The contract page shows the unit, the client, the sales rep, the reservation expiry, the final price, the down payment, the installment count and the schedule preview. The accountant approves. In one step the contract becomes approved, the unit becomes sold, the schedule is created with real due dates counted from today in Saudi time, and the approval is written to the audit log. If anything fails, none of it happens.

**Why this priority**: Approval turns a sale into money owed and is named in the brief's audit list and transaction rules. Payments (phase 6) need the approved schedule.

**Independent Test**: As an accountant, approve a draft of 100,000 riyals with a down payment of 10,000 and 3 installments. Confirm the contract is approved, the unit is sold, the schedule has a down payment line due today plus 3 monthly lines, the lines add up to 100,000, and one approval audit row exists. Then force a failure in the middle of approval and confirm the contract is still a draft, the unit is still reserved, no schedule exists and no audit row was written.

**Acceptance Scenarios**:

1. **Given** a draft whose reservation is still active, **When** the accountant approves it without any change since they opened it, **Then** the contract is approved with today's date (Saudi time) as its start date, the unit becomes "sold", the schedule is created, an approval audit row is written, and the accountant sees a success message.
2. **Given** a draft with a down payment above 0, **When** it is approved, **Then** the schedule has the down payment as the first line, due on the approval date, followed by the monthly installments.
3. **Given** a draft with a down payment of 0, **When** it is approved, **Then** the schedule has only the monthly installments, and nothing is due on the approval date. The first installment is due one month after the approval date.
4. **Given** approval on 31 January, **When** the schedule is created, **Then** installment 1 is due on the last day of February (28 February, or 29 February in a leap year), installment 2 on 31 March, installment 3 on 30 April, and so on. Each due date is counted from the approval date, never from the previous installment.
5. **Given** an approval at 22:00 on 30 January UTC, which is already 31 January in Saudi time, **When** the schedule is created, **Then** the start date is 31 January.
6. **Given** a draft whose reservation expired before approval, **When** the accountant approves, **Then** approval is refused with a clear Arabic message that the reservation expired, and nothing changes.
7. **Given** an accountant who opened a draft, **When** the sales rep changes the final price, the down payment or the installment count before the accountant presses approve, **Then** approval is refused as a conflict (409) with a clear Arabic message that the contract changed and must be reviewed again, the contract stays a draft, and the accountant's view refreshes to show the new values.
8. **Given** two accountants approving the same draft at the same moment, **When** both requests arrive, **Then** exactly one succeeds, the other is refused with a clear Arabic message that the contract is already approved, and only one schedule and one audit row exist.
9. **Given** a failure at any point during approval, **When** the approval stops, **Then** the contract is still a draft, the unit is still reserved, no schedule lines exist and no approval audit row exists.
10. **Given** a logged-in manager or sales rep, **When** they try to approve by calling the server directly, **Then** it is refused as "not allowed" (403) and nothing changes. The approve action is not shown to them.
11. **Given** an accountant of company A, **When** they try to approve a contract of company B, **Then** it is refused as "not found" (404) and nothing changes in either company.
12. **Given** an approved contract, **When** its reservation's 72 hours pass, **Then** the unit stays "sold" and the contract stays approved.

---

### User Story 3 - Sales rep edits their draft while it is not approved (Priority: P2)

A sales rep opens one of their draft contracts and changes the final price, the down payment or the installment count, with the same rules and the same live preview as on creation. Once the contract is approved, nobody can edit it.

**Why this priority**: Negotiation often changes the numbers before approval. It is P2 because the flow works with a correct first draft.

**Independent Test**: As a sales rep, edit a draft's installment count from 3 to 6 and confirm the draft shows 6. Approve it as an accountant, then try to edit it again as the rep (through the UI and by calling the server directly) and confirm it is refused and the values did not change.

**Acceptance Scenarios**:

1. **Given** the rep's own draft with an active reservation, **When** the rep changes any of the three values to valid ones and saves, **Then** the draft is updated and the preview and contract page show the new values.
2. **Given** an approved contract, **When** the rep tries to edit it (including by calling the server directly), **Then** it is refused as a conflict (409) with a clear Arabic message that an approved contract cannot be changed, and no value changes. The edit action is not shown on approved contracts.
3. **Given** a rep editing a draft at the same moment an accountant approves it, **When** both requests arrive, **Then** either the edit is saved first and the approval is refused as "contract changed", or the approval happens first and the edit is refused as "already approved". The approved values are never changed after approval.
4. **Given** a draft whose reservation has expired, **When** the rep tries to edit it, **Then** it is refused with a clear Arabic message that the reservation expired.
5. **Given** a draft made by another sales rep of the same company, or a contract of another company, **When** a rep tries to edit it, **Then** it is refused as "not found" (404).
6. **Given** a manager or an accountant, **When** they try to edit a draft by calling the server directly, **Then** it is refused as "not allowed" (403).
7. **Given** invalid values on edit, **When** the rep saves, **Then** the same validation as on creation applies, with each message next to its field.

---

### User Story 4 - Allowed users see contracts and each contract's schedule (Priority: P2)

An accountant or a manager sees all contracts of their company; a sales rep sees only contracts made from their own reservations. Each row shows the unit, the client, the sales rep, the final price, whether it is a draft or approved, and the remaining amount. Opening a contract shows its details and its schedule: each line with its number, due date, amount, paid amount and status (unpaid, partial, paid or overdue), and the remaining amount of the contract.

**Why this priority**: The brief requires the contract page with the schedule, each line's status and the remaining amount. It is P2 because creation and approval (Stories 1 and 2) are the core changes; this story shows their result.

**Independent Test**: With approved contracts whose lines are set to different paid amounts and due dates, open one as the accountant and confirm each line shows the right status and the remaining amount equals the final price minus all paid amounts. Log in as each role and confirm each sees exactly the contracts they should.

**Acceptance Scenarios**:

1. **Given** contracts from several reps of company A, **When** the accountant or the manager of company A opens the contracts page, **Then** they see all of them, and none from company B.
2. **Given** a sales rep, **When** they open the contracts page, **Then** they see only contracts made from their own reservations.
3. **Given** a schedule line whose paid amount equals its amount, **When** it is shown, **Then** its status is "paid", whatever its due date.
4. **Given** a schedule line that is not fully paid and whose due date is before today (Saudi time), **When** it is shown, **Then** its status is "overdue", even if part of it is paid. Its paid amount is still shown.
5. **Given** a schedule line due today or later with part of it paid, **When** it is shown, **Then** its status is "partial".
6. **Given** a schedule line due today or later with nothing paid, **When** it is shown, **Then** its status is "unpaid". A line due today is not overdue.
7. **Given** a down payment line that was not paid on the approval date, **When** the contract is viewed on the next day, **Then** the down payment line is "overdue".
8. **Given** an approved contract, **When** it is shown, **Then** the remaining amount equals the final price minus the sum of all paid amounts. Right after approval it equals the final price.
9. **Given** a draft, **When** it is opened, **Then** the page shows "draft", the three values, the schedule preview with dates estimated as if approved today under the label "التواريخ تقديرية، وتُثبَّت عند الاعتماد", and no line statuses or paid amounts. An approved contract shows its stored dates with no label.
10. **Given** a draft whose reservation has expired, **When** it is shown in the list or opened, **Then** it is marked "reservation expired", and the approve and edit actions are not offered.
11. **Given** a contract of another company, or a contract from another rep's reservation for a sales rep, **When** a user opens it by its address or calls the server directly, **Then** the answer is "not found" (404).
12. **Given** more contracts than fit on one page, **When** the user moves to the next page, **Then** the next slice is shown with no contract repeated or skipped.
13. **Given** the contracts page or the contract page, **When** data is loading, missing or failed, **Then** a loading state, an empty state with a clear Arabic message, or an error state with a retry action is shown.

---

### Edge Cases

- **31 January start**: installment 1 is due on the last day of February (28 or 29), installment 2 on 31 March. Dates are always counted from the start date, so a short month never shifts later dates.
- **Leap year**: a contract approved on 31 January 2028 has installment 1 due on 29 February 2028; one approved on 31 January 2027 has it due on 28 February 2027. A contract approved on 29 February 2028 has installment 12 due on 28 February 2029.
- **Rounding**: 100,000 riyals over 3 installments with no down payment gives 33,333 / 33,333 / 33,334. Monthly installments are whole riyals, and the last installment takes the whole remainder.
- **Final price with halalas**: the lowest allowed final price can have halalas (it is rounded up to the halala). The down payment may also have halalas. Only the last installment can carry halalas; every other installment is whole riyals.
- **Down payment 0**: no down payment line exists. The first line is installment 1, due one month after approval.
- **One installment**: the whole amount left after the down payment is one line due one month after approval.
- **Tiny remainder**: if the amount left after the down payment is less than 1 riyal per installment, the draft is refused at save time, because every line must be at least 1 riyal.
- **Final price above the unit price**: allowed, up to 1,000,000,000 riyals. The brief sets only a floor (see Assumptions).
- **Midnight in Saudi time**: the start date and "today" are always the calendar date in Saudi time (Asia/Riyadh), not the server's or the browser's date.
- **Due today**: not overdue. A line becomes overdue on the day after its due date if it is not fully paid.
- **Double click on save or approve**: the button cannot be pressed again while the request runs. A second create request is refused as "contract already exists"; a second approve request is refused as "already approved".
- **Reservation expires with a draft**: the draft stays as history but cannot be edited or approved. The unit becomes available again (phase 4 rule) and can be reserved by anyone. A new reservation can get its own new contract.
- **Unit price changes**: the unit price is locked while the unit is reserved (phase 3), so the 95% floor of a draft cannot move under it.
- **Unit no longer reserved at approval** (should never happen with the rules above): approval is refused and nothing changes.
- **Invalid ids**: an id with an invalid format is a validation error (400). A well-formed id that matches no record the user may see is "not found" (404).
- **Delete or cancel**: no action exists, for any role, to delete a draft or cancel a contract (out of scope).

## Requirements *(mandatory)*

### Functional Requirements

**Creating a draft**

- **FR-001**: Only a sales rep MUST be able to create a contract, and only from their own reservation. A manager or an accountant MUST be refused as "not allowed" (403). Another rep's reservation, or a reservation of another company, MUST be refused as "not found" (404).
- **FR-002**: A contract MUST be created only from a reservation that is active (its expiry time is still in the future). A request for an expired reservation MUST be refused with a clear Arabic message, and nothing MUST be saved.
- **FR-003**: A reservation MUST have at most one contract, draft or approved. A second contract for the same reservation MUST be refused as a conflict (409), also when two requests arrive at the same moment.
- **FR-004**: The request MUST carry only the reservation, the final price, the down payment and the installment count. The company, the sales rep, the unit, the client, the approval date, the status and the schedule MUST be set by the server; any such values sent by the user MUST be ignored.
- **FR-005**: A new contract MUST be a draft: not approved, with no schedule lines, and its unit MUST stay reserved.

**Contract values**

- **FR-006**: The final price MUST be at least 95% of the unit price, rounded up to the next whole halala. A lower value MUST be refused with a message that names the lowest allowed price.
- **FR-007**: The down payment MUST be zero or more and strictly less than the final price.
- **FR-008**: The installment count MUST be a whole number from 1 to 120 (see Assumptions).
- **FR-009**: The amount left after the down payment MUST be at least 1 riyal per installment. Otherwise the values MUST be refused at save time with a message next to the installment count.
- **FR-010**: Money MUST be entered and shown in riyals with up to two decimals, and kept as exact whole halalas everywhere. No step may lose or add a halala.
- **FR-011**: Every validation error MUST be shown next to its field, in Arabic. The server MUST apply the same rules as the form.

**Schedule**

- **FR-012**: The schedule MUST be produced by one rule, used for both the preview and the approved schedule:
  - if the down payment is above 0, line 0 is the down payment, due on the start date;
  - the amount left after the down payment is divided into the installment count; each installment is the whole-riyal part of an equal share, and the last installment takes the whole remainder;
  - installment *i* (from 1) is due *i* months after the start date, counted from the start date each time; if that day does not exist in the month, it is due on the last day of that month.
- **FR-013**: The sum of all schedule lines MUST equal the final price exactly, to the halala, for every valid set of values.
- **FR-014**: If the down payment is 0, no down payment line MUST exist, and nothing MUST be due on the start date.
- **FR-015**: Before approval, the create and edit preview and the draft contract page MUST run the same schedule rule (FR-012) with today's date in Saudi time as the start date, and MUST show the label "التواريخ تقديرية، وتُثبَّت عند الاعتماد" on the schedule. On approval, the start date MUST be the approval date in Saudi time, and the stored due dates MUST be computed from it. An approved contract MUST show its stored dates with no label.

**Editing a draft**

- **FR-016**: Only the sales rep who owns the reservation MUST be able to edit a draft, and only its final price, down payment and installment count, under the same rules as creation (FR-006 to FR-011). Other roles MUST be refused (403); another rep's or another company's contract MUST be refused as "not found" (404).
- **FR-017**: A draft whose reservation has expired MUST NOT be editable; the request MUST be refused with a clear Arabic message.
- **FR-018**: An approved contract MUST never change. An edit request on it MUST be refused as a conflict (409) with a clear Arabic message, also when the edit and the approval arrive at the same moment.

**Approval**

- **FR-019**: Only an accountant MUST be able to approve. A manager or a sales rep MUST be refused (403). A contract of another company MUST be refused as "not found" (404).
- **FR-020**: Approval MUST be refused with a clear Arabic message if the reservation has expired.
- **FR-021**: The approve request MUST carry the final price, the down payment and the installment count that the accountant saw. If any of them differs from the stored draft at the moment of approval, approval MUST be refused as a conflict (409) with a clear Arabic message that the contract changed, and the accountant's view MUST refresh.
- **FR-022**: Approving an already approved contract MUST be refused as a conflict (409) with a clear Arabic message. When two approvals arrive at the same moment, exactly one MUST succeed.
- **FR-023**: Approval MUST happen as one all-or-nothing step: the contract becomes approved with its approval time, the unit changes from reserved to sold, the schedule lines are stored, and one contract-approval audit row is written (who approved, which contract, the unit price, and the approved final price, down payment and installment count). If any part fails, none of it MUST remain.
- **FR-024**: After approval, the unit MUST stay sold, even after the reservation's 72 hours pass.

**Viewing**

- **FR-025**: An accountant and a manager MUST see all contracts of their own company. A sales rep MUST see only contracts made from their own reservations. A manager MUST NOT create, edit or approve.
- **FR-026**: The contracts list MUST show for each contract: the unit's project name and number, the client's name, the sales rep's name, the final price, draft or approved (and "reservation expired" for a draft whose reservation expired), and the remaining amount.
- **FR-027**: The contracts list MUST be paged by the server (20 per page by default, at most 50) and MUST have no status filter. It MUST have a stable order: drafts first, then approved contracts with the most recent approval first, with a fixed tie-breaker so paging never repeats or skips a contract. Paging parameters MUST be validated; invalid values MUST be refused (400).
- **FR-028**: The contract page MUST show the unit, the client, the sales rep, the reservation's expiry date and time, the unit price, the final price, the down payment, the installment count, the approval date (when approved), the remaining amount, and the schedule.
- **FR-029**: For an approved contract, each schedule line MUST show its number (the down payment marked as such), due date, amount, paid amount and status. The status MUST be computed when shown, never stored:
  - "paid" if the paid amount equals the amount;
  - otherwise "overdue" if the due date is before today in Saudi time;
  - otherwise "partial" if part of it is paid;
  - otherwise "unpaid".
- **FR-030**: The remaining amount MUST equal the final price minus the sum of all paid amounts, computed when shown.
- **FR-031**: Contracts of another company MUST never appear in any list or page, for any role.

**User interface**

- **FR-032**: The "create contract" action MUST appear only for sales reps, on their own active reservations that have no contract yet, on the reservations page.
- **FR-033**: The edit action MUST appear only to the owning sales rep on a draft with an active reservation. The approve action MUST appear only to accountants on a draft with an active reservation.
- **FR-034**: While a create, edit or approve request runs, its button MUST show a loading state and MUST NOT be pressed again. A conflict (409) MUST be shown as a message at the top of the form or page.
- **FR-035**: After a successful create, edit or approve, the contracts list, the contract page, the reservations list and the units list MUST show the new state without a manual page reload.
- **FR-036**: The contracts section MUST appear in the navigation for all three roles, following the phase 2 role map.
- **FR-037**: All text MUST be in Arabic and laid out right-to-left. Dates MUST be shown in Saudi time. Pages MUST work on mobile and desktop.

**Proof (tests)**

- **FR-038**: Unit tests of the schedule rule MUST cover: a 31 January start (end of February, then 31 March); a leap-year February (29 February); 100,000 riyals over 3 installments (33,333 / 33,333 / 33,334); a down payment of 0 (no line 0); and that the sum always equals the final price, over many value combinations including halalas in the final price and the down payment.
- **FR-039**: Unit tests of the status rule MUST cover paid, partial, unpaid, overdue, partial and overdue together (overdue wins), and a line due today (not overdue).
- **FR-040**: Integration tests against a real database MUST prove:
  - approval is all-or-nothing: with a failure forced partway through approval, the contract is still a draft, the unit is still reserved, no schedule lines exist and no approval audit row exists;
  - a successful approval sets the contract approved, the unit sold, stores the schedule summing to the final price, and writes one audit row;
  - an approved contract cannot be edited (409), and its values do not change;
  - approval with changed values is refused (409) and the contract stays a draft;
  - approval of a draft with an expired reservation is refused and nothing changes;
  - a second contract for the same reservation is refused;
  - a user of company A gets "not found" (404) for a contract of company B (view, edit, approve), and a sales rep gets "not found" for another rep's reservation or contract (create, view, edit);
  - a manager and a sales rep cannot approve (403), and a manager and an accountant cannot create or edit (403).

### Permissions Summary

| Action | Manager | Sales rep | Accountant |
|---|---|---|---|
| Create a draft | No (403) | Yes, from own active reservation | No (403) |
| Edit a draft | No (403) | Own draft only, while not approved and reservation active | No (403) |
| Approve a draft | No (403) | No (403) | Yes, any draft in own company |
| See contracts and schedules | All in own company | Own only | All in own company |
| Delete a draft or cancel a contract | No (no such action) | No (no such action) | No (no such action) |

### Key Entities *(include if feature involves data)*

- **Contract** (exists since phase 1): made from one reservation (at most one contract per reservation). Holds the final price, the down payment, the installment count, and the approval time. No approval time means draft. The unit, client and sales rep come from its reservation. Once approved it never changes.
- **Installment / schedule line** (exists since phase 1): one line of an approved contract: its number (0 for the down payment, 1 and up for monthly installments), due date (a calendar date), amount and paid amount. Created only on approval. Its status is computed when shown, never stored. Paid amounts change only through payments (phase 6).
- **Reservation** (phase 4): the source of a contract. Must be active to create, edit or approve a contract from it.
- **Unit** (phase 3): goes from reserved to sold on approval, and never back.
- **Audit log entry** (phase 1): one entry per approval, recording who approved, the contract, the unit price and the approved values, so a final price above or below the unit price is visible.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For 100% of valid value combinations tested, the schedule lines add up to the final price exactly, to the halala.
- **SC-002**: 100% of schedules for contracts started on the 29th, 30th or 31st of a month have every due date in the intended month (on the last day when the day does not exist), with none skipped or doubled.
- **SC-003**: In 100% of runs of the forced-failure approval test, the contract, the unit, the schedule and the audit log are left exactly as before approval.
- **SC-004**: 0 approved contracts can be changed by any user, through the UI or by calling the server directly.
- **SC-005**: 0 contracts can be approved after their reservation expired or after their values changed since the accountant opened them.
- **SC-006**: 0 contracts of another company, and 0 contracts of another rep for a sales rep, appear in any list or page. Each direct attempt returns "not found".
- **SC-007**: A sales rep can create a draft from an active reservation in under 1 minute, and sees the preview update as they type.
- **SC-008**: An accountant can open a draft, check it and approve it in under 30 seconds.
- **SC-009**: All unit and integration tests in FR-038 to FR-040 pass on a fresh test database.

## Assumptions

- **Installment count limit** (confirmed in Clarifications): 1 to 120 monthly installments (10 years). The brief sets only a minimum of 1. The maximum of 120 is a safety bound against huge inputs (for example a request with a million installments), and it is one constant in code if it needs to change. The "at least 1 riyal per installment" rule (FR-009) also limits the count for small amounts.
- **Final price above the unit price** (confirmed in Clarifications): allowed, up to the global limit of 1,000,000,000 riyals. The brief sets only a floor (at most 5% discount). Control: only an accountant can approve, after comparing the values, and the approval is audited. The contract-approval audit entry includes both the unit price and the final price, so any difference is visible.
- **Whole-riyal installments**: monthly installments are whole riyals; the last one takes the whole remainder, including any halalas. The down payment may have halalas. This keeps installments simple to pay and the total exact.
- **Start date and dates**: the start date is the approval date in Saudi time. Installment *i* is due *i* months after the start date, counted from the start date each time; a day that does not exist becomes the last day of that month. So a 31 January start gives 28/29 February, 31 March, 30 April.
- **Preview dates** (confirmed in Clarifications): a draft has no start date yet, so the preview and the draft page call the same schedule function used at approval, with today (Asia/Riyadh) as the start date, under the label "التواريخ تقديرية، وتُثبَّت عند الاعتماد". After approval, the stored dates are shown with no label.
- **Status priority**: paid, then overdue, then partial, then unpaid. A partly paid line past its due date is "overdue", and its paid amount is still shown. A line due today is not overdue.
- **Draft viewers**: the manager sees all contracts of the company read-only, per the brief ("sees everything inside his company") and the phase 2 navigation map. "Any allowed user" covers the manager, the accountant and the owning sales rep.
- **Accountant view of the reservation**: the contract page shows the unit, client, sales rep and reservation expiry, as promised in the phase 4 clarifications.
- **Stale drafts**: a draft whose reservation expired stays as history, marked "reservation expired", and cannot be edited or approved. The unit is released by the phase 4 rule and may be reserved again, with a new contract.
- **Change check on approval**: the values compared are the only editable ones: final price, down payment and installment count.
- **Draft remaining amount**: a draft has no schedule and nothing paid, so its remaining amount is the final price.
- **List order and filter** (confirmed in Clarifications): no status filter. Drafts first, then approved contracts by most recent approval, with a fixed tie-breaker; drafts whose reservation expired are marked in the list. Contracts have no creation time, and adding one is not needed by any brief rule.
- **No audit entry for draft create or edit**: the brief's audit list includes contract approvals, not drafts. Unit price changes are audited by phase 3; a contract's final price is not a unit price change.
- **Where drafts start**: from the reservations page (phase 4), on the rep's own active reservations without a contract.
- **No delete or cancel**: contract cancellation is out of scope (brief). A draft cannot be deleted either; it simply stops being usable when its reservation expires.
- **Payments**: recording payments and changing paid amounts belong to phase 6. In this phase all paid amounts are 0 after approval, so tests set paid amounts directly to check statuses and the remaining amount.
- **Status codes**: role not allowed → 403; another rep's or another company's record, or a record that does not exist → 404; a second contract for a reservation, editing or approving an approved contract, changed values, or an expired reservation → 409; invalid input → 400.

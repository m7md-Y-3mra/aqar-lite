# Feature Specification: Payments

**Feature Branch**: `claude/contract-payments-af18e9`

**Created**: 2026-11-13

**Status**: Draft

**Input**: User description: "Add payments (see docs/brief.md sections 2 and 3.6). User stories: As an accountant, I record a payment of any amount on an approved contract. As an accountant or manager, I see the payments of a contract and how the schedule changed. Rules: A payment is allocated to the oldest unpaid installments first (the down payment first). Each installment becomes partial or paid. A payment cannot be more than the remaining amount of the contract. A larger amount is refused with a clear message. Clicking "Save" twice or resending the request after a network failure must not create two payments. The same request returns the same result. Two accountants recording payments on the same contract at the same moment must never pay more than the remaining amount. A recorded payment cannot be edited or deleted by anyone. Every payment is written to the audit log, including how it was allocated to installments. Only accountants record payments. Payments on contracts of another company return 404. Done when: Unit tests cover: a partial payment, a payment that covers several installments, and an exact final payment. Integration tests prove: a repeated request with the same key creates one payment; overpayment is refused; a sales rep cannot record a payment."

**Depends on**: phase 5, Contracts and Installment Schedule (`specs/006-contracts-installment-schedule`, on branch
`claude/contracts-installment-schedule-699d4a`). This spec uses its terms: approved contract, schedule line, line
number (0 = down payment), paid amount, line status (FR-029 there) and remaining amount (FR-030 there).

## Clarifications

### Session 2026-11-13

- Q: A request reuses an existing key on the same contract with a different amount. What happens? → A: Refused with
  409 (key reused) and an Arabic message that includes the amount already saved; no new payment. Same key, same
  contract, same amount still returns the original payment. On this 409 the form shows the message, refreshes the
  contract's payments and schedule, and makes a new key.
- Q: Does a sales rep see the payments list of their own contracts? → A: No. Reps see paid amounts and statuses on
  the schedule only. Reading a contract's payments as a sales rep returns 403.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Accountant records a payment (Priority: P1)

An accountant opens an approved contract of their company, enters an amount in riyals and saves. The system applies
the amount to the schedule lines in order, starting from the lowest line number that is not fully paid (the down
payment first, when there is one). Each line it touches becomes fully or partly paid. The remaining amount of the
contract goes down by exactly the amount paid.

**Why this priority**: recording payments is the last step of the brief's main flow (brief section 2, step 5) and the
reason the schedule exists. Without it, no contract can ever be paid.

**Independent Test**: approve a contract with a known schedule, record one payment, and check the payment exists, the
paid amounts of the lines changed as expected, and the remaining amount dropped by the amount paid.

**Acceptance Scenarios**:

1. **Given** an approved contract with a down payment of 50,000 riyals and monthly lines of 10,000 riyals, none paid
   and none due yet, **When** the accountant records 20,000 riyals, **Then** the down payment line shows 20,000 paid
   with status "partial", the other lines are unchanged, and the remaining amount drops by 20,000.
2. **Given** the same contract after that payment, **When** the accountant records 45,000 riyals, **Then** 30,000
   completes the down payment line ("paid"), 10,000 completes line 1 ("paid"), and 5,000 goes to line 2 ("partial").
3. **Given** an approved contract with a remaining amount of 12,345.67 riyals, **When** the accountant records exactly
   12,345.67 riyals, **Then** every line shows "paid" and the remaining amount is 0.
4. **Given** an approved contract with a down payment of 0, **When** the accountant records a payment, **Then** the
   payment starts at line 1.
5. **Given** a contract with a remaining amount of 1,000 riyals, **When** the accountant records 1,000.01 riyals,
   **Then** the payment is refused with a clear Arabic message that names the remaining amount, and nothing changes.
6. **Given** a draft contract (not approved), **When** an accountant tries to record a payment, **Then** it is refused
   with a clear Arabic message that the contract is not approved yet, and nothing is saved.
7. **Given** a fully paid contract, **When** the accountant opens it, **Then** no "record payment" action is shown, and
   a request sent by hand is refused because the amount is above the remaining amount (0).

---

### User Story 2 - A repeated request never creates a second payment (Priority: P1)

The accountant clicks "Save" twice, or the network fails after the server saved the payment and the browser sends the
same request again. The system records the payment once and returns the same result to every copy of the request.

**Why this priority**: the brief marks this rule in bold (brief 3.6). A double payment is a direct financial error.

**Independent Test**: send the same payment request (same key) twice in a row, and twice at the same moment; check
that exactly one payment exists, both responses describe that same payment, and the paid amounts changed only once.

**Acceptance Scenarios**:

1. **Given** a payment was recorded with key K, **When** the same request with key K arrives again, **Then** no new
   payment is created, no line changes, no new audit entry is written, and the response describes the original
   payment.
2. **Given** an exact final payment was recorded with key K (remaining amount now 0), **When** the same request with
   key K arrives again, **Then** it returns the original payment; it is NOT refused as an overpayment.
3. **Given** two identical requests with key K arrive at the same moment, **When** both finish, **Then** exactly one
   payment exists and both responses describe it.
4. **Given** key K was used on contract A, **When** a request with key K arrives for contract B, **Then** it is
   treated as a new payment on contract B (keys are scoped to one contract).
5. **Given** a payment was recorded with key K for 5,000 riyals, **When** a request with key K for a different amount
   arrives on the same contract, **Then** it is refused as a conflict (409) with an Arabic message that includes the
   amount already saved (5,000 riyals), no new payment is created, and the form refreshes the contract's payments and
   schedule and makes a new key.
6. **Given** a request has no key, or a key longer than the allowed length, **When** it arrives, **Then** it is
   refused as invalid input and nothing is saved.

---

### User Story 3 - Two accountants pay at the same moment (Priority: P1)

Two accountants of the same company record payments on the same contract at the same moment. The total paid can never
pass the final price, and no line can be paid twice.

**Why this priority**: the brief tests real concurrent requests. A race here would break the core money rule
(constitution III and IV).

**Independent Test**: on a contract with a remaining amount of 10,000 riyals, send two payments of 6,000 riyals with
different keys at the same moment; check that exactly one succeeds and the other is refused as above the remaining
amount.

**Acceptance Scenarios**:

1. **Given** a remaining amount of 10,000 riyals, **When** two payments of 6,000 riyals with different keys arrive at
   the same moment, **Then** exactly one is recorded and the other is refused with the "above remaining amount"
   message naming the new remaining amount (4,000 riyals).
2. **Given** a remaining amount of 10,000 riyals, **When** two payments of 4,000 riyals with different keys arrive at
   the same moment, **Then** both are recorded, one after the other, and the remaining amount is 2,000 riyals.

---

### User Story 4 - See a contract's payments and the updated schedule (Priority: P2)

An accountant or a manager opens an approved contract and sees its payments (amount, and date and time in Saudi time)
and the schedule with the current paid amount and status of each line, and the remaining amount. After a payment is
recorded, the page shows the new state without a manual reload.

**Why this priority**: the brief requires the contract page to show the schedule, statuses and remaining amount; the
payments list lets the accountant and the manager see what was paid and when. It adds no new money rule, so it comes
after the recording stories.

**Independent Test**: record two payments on a contract, open the contract page as the accountant and as the manager,
and check both payments are listed and the schedule shows the matching paid amounts and statuses.

**Acceptance Scenarios**:

1. **Given** a contract with two payments, **When** the accountant or the manager opens it, **Then** both payments are
   listed, newest first, each with its amount and its date and time in Saudi time.
2. **Given** an approved contract with no payments, **When** it is opened, **Then** the payments section shows a clear
   empty state.
3. **Given** the accountant just recorded a payment, **When** the request succeeds, **Then** the payments list, the
   schedule, the remaining amount and the contracts list show the new state without a manual reload, and a success
   message is shown.
4. **Given** a line that is past its due date and partly paid, **When** the contract is shown, **Then** its status is
   "overdue" (phase 5 rule: overdue wins over partial) and its paid amount is shown.
5. **Given** a sales rep opens their own approved contract, **When** the page loads, **Then** they see the schedule
   with paid amounts, statuses and the remaining amount (phase 5), but no payments section; a request for the
   contract's payments sent by hand is refused as "not allowed" (403).

---

### Edge Cases

- **Retry after the final payment**: the repeated-key check runs before the "above remaining amount" check, so the
  retry returns the original payment instead of a false overpayment error.
- **Same key, different amount**: refused (409) with the amount already saved; the form refreshes and makes a new key.
- **Role and company checks come first**: a sales rep or manager sending a known key still gets "not allowed" (403);
  a contract of another company gets "not found" (404) even with a known key. A key never reveals a payment across
  roles or companies.
- **Draft contract**: no schedule exists yet, so a payment is refused (409) with a clear message.
- **Fully paid contract**: remaining amount is 0; any new payment is refused as above the remaining amount.
- **Down payment 0**: there is no line 0; allocation starts at line 1.
- **Halalas**: the down payment and the last installment may carry halalas, so payments accept up to two decimals.
  Without this, some contracts could never be paid off exactly.
- **Amount 0, negative, more than two decimals, or not a number**: refused as invalid input (400), message next to the
  amount field.
- **Overdue lines**: allocation order is by line number only. Being overdue does not change the order, and an overdue
  line is paid like any other.
- **Payment spanning many lines**: one payment may fill many lines and part of one more; the allocation lists each.
- **Expired reservation**: after approval the reservation's expiry no longer matters (phase 5 FR-024); payments are
  allowed on any approved contract.
- **Edit or delete**: there is no action, page or endpoint to edit or delete a payment. Direct changes in the database
  are blocked by the phase 1 triggers.

## Requirements *(mandatory)*

### Functional Requirements

**Recording a payment**

- **FR-001**: Only an accountant MUST be able to record a payment. A manager or a sales rep MUST be refused as "not
  allowed" (403). A contract of another company, or one that does not exist, MUST be refused as "not found" (404).
- **FR-002**: A payment MUST be recorded only on an approved contract. A payment on a draft MUST be refused as a
  conflict (409) with a clear Arabic message, and nothing MUST be saved.
- **FR-003**: The request MUST carry only the contract, the amount and a request key. The company, the user, the
  payment date and the allocation MUST be set by the server; any such values sent by the user MUST be ignored.
- **FR-004**: The amount MUST be entered in riyals, greater than 0, with at most two decimals, and MUST be kept as
  exact whole halalas. Invalid amounts MUST be refused (400) with an Arabic message next to the amount field.
- **FR-005**: The amount MUST NOT be more than the contract's remaining amount at the moment the payment is recorded.
  A larger amount MUST be refused as a conflict (409) with a clear Arabic message that names the remaining amount, and
  nothing MUST be saved.
- **FR-006**: The payment date MUST be the moment the server records the payment (see Assumptions).

**Allocation**

- **FR-007**: A payment MUST be applied to the schedule lines in order of line number, lowest first (the down payment,
  line 0, first when it exists), skipping fully paid lines. Each line MUST receive as much as it still needs, until
  the payment is used up.
- **FR-008**: The amounts applied by one payment MUST add up to the payment amount exactly. No line MUST ever be paid
  more than its amount.
- **FR-009**: At all times, the sum of all payments of a contract MUST equal the sum of the paid amounts of its lines,
  and MUST NOT be more than the final price.
- **FR-010**: Line statuses and the remaining amount MUST keep following the phase 5 rules (computed when shown, never
  stored): a line becomes "paid" when its paid amount equals its amount, and "partial" when part is paid and it is not
  past due; a partly paid line past its due date shows "overdue".

**Repeated requests**

- **FR-011**: Every payment request MUST carry a request key chosen by the client. A request without a key, or with a
  key that is empty or longer than 100 characters, MUST be refused as invalid input (400).
- **FR-012**: A key MUST be unique within one contract. If a payment with the same key already exists on that
  contract, the system MUST NOT create a new payment, change any line or write a new audit entry, and MUST return the
  original payment. This check MUST run after the role and company checks and before the amount checks (FR-005).
- **FR-013**: The same key on a different contract MUST be treated as a new, separate payment.
- **FR-014**: A request with an existing key on the same contract but a different amount MUST be refused as a
  conflict (409, key reused) with an Arabic message that includes the amount already saved with that key. No new
  payment MUST be created, no line MUST change and no audit entry MUST be written. This check runs at the same point
  as FR-012.
- **FR-015**: The payment form MUST create one key when it opens, keep it across retries and double clicks, and make
  a new key only after a successful save or after a "key reused" conflict (FR-014). On that conflict, the form MUST
  show the message at the top and refresh the contract's payments and schedule.

**Concurrency and atomicity**

- **FR-016**: Recording a payment MUST happen as one all-or-nothing step: the payment is stored, the paid amounts of
  the lines change, and one audit entry is written. If any part fails, none of it MUST remain.
- **FR-017**: Payments on the same contract MUST be recorded one at a time. When several arrive at the same moment,
  each MUST see the result of the ones before it, so the total paid never passes the final price.
- **FR-018**: Two requests with the same key arriving at the same moment MUST produce exactly one payment, and both
  MUST receive it.

**Payments never change**

- **FR-019**: There MUST be no action, page or endpoint to edit or delete a payment, for any role. The existing
  database guard (phase 1) that blocks changing or deleting payment rows MUST stay in place.

**Audit**

- **FR-020**: Every new payment MUST write one payment-recorded audit entry with: the accountant who recorded it, the
  contract, the amount, the allocation (each line number and the amount applied to it), and the remaining amount after
  the payment. A repeated request that returns an existing payment MUST NOT write an entry.

**Viewing**

- **FR-021**: The contract page MUST show, for an approved contract, a payments section listing every payment of the
  contract, newest first, with its amount and its date and time in Saudi time. A contract with no payments MUST show
  a clear empty state. A draft contract MUST show no payments section.
- **FR-022**: The accountant and the manager MUST see the payments of every approved contract in their own company.
  A sales rep MUST NOT see payments: the payments section MUST NOT be shown to them, and a request for a contract's
  payments MUST be refused as "not allowed" (403), even for their own contract. Payments of another company MUST
  never appear, for any role.
- **FR-023**: After a successful payment, the payments list, the schedule (paid amounts and statuses), the remaining
  amount and the contracts list MUST show the new state without a manual page reload.

**User interface**

- **FR-024**: The "record payment" action MUST appear only to accountants, on approved contracts with a remaining
  amount above 0. A fully paid contract MUST show that it is fully paid.
- **FR-025**: The payment form MUST show the remaining amount next to the amount field.
- **FR-026**: While the save request runs, the button MUST show a loading state and MUST NOT be pressed again.
  Validation errors (400) MUST show next to the amount field; conflicts (409) MUST show as a message at the top of the
  form. A success MUST show a confirmation message and clear the form.
- **FR-027**: All text MUST be in Arabic and laid out right-to-left. Dates and times MUST be shown in Saudi time. The
  form and the payments list MUST work on mobile and desktop, with loading, empty and error states.

**Proof (tests)**

- **FR-028**: Unit tests of the allocation rule MUST cover: a partial payment (one line partly paid); a payment that
  covers several lines and part of the next; an exact final payment (all lines paid, nothing left); a payment into a
  line that is already partly paid; a contract with a down payment of 0 (starts at line 1); and that the applied
  amounts always add up to the payment and never overfill a line.
- **FR-029**: Integration tests against a real database MUST prove:
  - a repeated request with the same key creates one payment, changes the lines once, writes one audit entry, and
    returns the original payment; this also holds for a retry after an exact final payment;
  - two identical requests with the same key sent at the same moment create exactly one payment;
  - the same key with a different amount on the same contract is refused (409) and the payment count does not
    change;
  - an overpayment is refused (409) and nothing changes;
  - two payments with different keys sent at the same moment, whose sum is above the remaining amount, result in
    exactly one payment;
  - a sales rep and a manager cannot record a payment (403), and a sales rep cannot read a contract's payments
    (403);
  - an accountant of company A gets "not found" (404) for a contract of company B, for recording and for viewing;
  - a payment on a draft contract is refused (409) and nothing is saved;
  - a successful payment updates the lines as the allocation rule says and writes one audit entry with the
    allocation.

### Permissions Summary

| Action | Manager | Sales rep | Accountant |
|---|---|---|---|
| Record a payment | No (403) | No (403) | Yes, on approved contracts in own company |
| See a contract's payments | All in own company | No (403); sees paid amounts and statuses on the schedule only | All in own company |
| Edit or delete a payment | No (no such action) | No (no such action) | No (no such action) |

### Key Entities *(include if feature involves data)*

- **Payment** (exists since phase 1): one amount received for one approved contract, with its request key (unique
  within the contract) and the time it was recorded. Never changed or deleted.
- **Schedule line / installment** (phase 5): its paid amount grows only through payments, never above its amount.
- **Contract** (phase 5): must be approved to receive payments. Its remaining amount is the final price minus all
  paid amounts.
- **Audit log entry** (phase 1): one payment-recorded entry per new payment, holding who recorded it, the contract,
  the amount, the allocation per line and the remaining amount after it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An accountant can record a payment on an approved contract in under 30 seconds from opening the
  contract page.
- **SC-002**: For every contract, the total of its payments equals the total of its lines' paid amounts, to the
  halala, and never exceeds the final price, including under concurrent requests.
- **SC-003**: Sending the same payment request any number of times, in a row or at the same moment, results in
  exactly one payment and one audit entry.
- **SC-004**: 100% of payment attempts by managers, sales reps or users of another company are refused, and none of
  them changes any data.
- **SC-005**: 100% of overpayment attempts are refused with a message that tells the accountant the exact remaining
  amount.
- **SC-006**: After a payment, the accountant sees the updated schedule and remaining amount without reloading the
  page.
- **SC-007**: Every recorded payment can be traced in the audit log to the accountant who recorded it and the lines it
  paid.

## Assumptions

- **Phase order**: this phase needs phase 5 (approved contracts with stored schedules). Planning and building start
  only after phase 5 is merged, per the constitution's development workflow.
- **Payment date**: always the moment the server records the payment. There is no field to enter a past or future
  payment date; backdating is not in the brief and would make the audit trail weaker.
- **Payment fields**: only the amount. No payment method, reference number or note; the brief asks only for "a
  payment of any amount".
- **Halalas allowed**: payments accept up to two decimals, because the down payment and the last installment may
  carry halalas; a whole-riyal-only rule could make some contracts impossible to pay off exactly.
- **Allocation order**: "oldest" means the lowest line number. Due dates rise with the line number, so this is also
  the earliest due date. Overdue status does not change the order.
- **Overpayment is a conflict (409)**: the limit depends on the contract's current state, which another accountant can
  change at the same moment, so it is treated like the other state conflicts in this project.
- **Request key length**: at most 100 characters; the form sends a random UUID.
- **Same key, different amount** (confirmed with the user, 2026-11-13): refused as a conflict (409, key reused) with
  the amount already saved in the message, instead of silently returning the original payment. This changes the
  agreed phase 6 plan note in `docs/phases.md` ("if (contractId, idempotencyKey) exists, return that payment"), which
  now applies only when the amount is the same. Reason: the form keeps its key until success, so an accountant who
  edits the amount after a network failure would otherwise believe the new amount was saved. The form then refreshes
  the contract and makes a new key.
- **Sales rep and payments** (confirmed with the user, 2026-11-13): a sales rep does not see the payments list, even
  on their own contracts. They see paid amounts, statuses and the remaining amount on the schedule only (phase 5).
  Reading a contract's payments as a sales rep returns 403. Reason: the brief's user story names only the accountant
  and the manager, and the rep needs no more than the schedule to follow their client.
- **"How the schedule changed"**: shown as the payments list plus the schedule's current paid amounts, statuses and
  remaining amount, refreshed after each payment. The contract page does not show a per-payment breakdown by line or
  who recorded each payment; both are kept in the audit entry (FR-020), which the manager reads in phase 7. Showing
  them on the contract page would need a schema change for no brief requirement.
- **Payments list length**: the payments of one contract are shown in full on the contract page, newest first. A
  contract has a bounded number of lines (at most 121) and payments are entered by hand by the company's own
  accountants, so the list stays small in practice.
- **Status codes**: role not allowed → 403; another company's contract, or one that does not exist → 404; draft
  contract, amount above the remaining amount, or a key reused with a different amount → 409; invalid amount or missing or invalid key → 400.
- **Immutability test**: the database guard against changing or deleting payments already has an integration test
  from phase 1 (`tests/integration/prisma/append-only.test.ts`); this phase adds no update or delete code to test.

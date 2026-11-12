# Brief — Technical Test: Full-Stack Developer

<!--
English translation of RA-Hiring-Test-FullStack.pdf (8 pages). The Arabic copy is docs/brief.ar.md.
The PDF is the source of truth. If this translation and the Arabic text disagree, the Arabic text wins.
Do not edit the requirements; add notes only in HTML comments.
-->

- Company: Al Riyada Al Khadra (Green Leadership Company)
- Project: build "Aqar Lite", a system to sell real-estate units by installments
- Document number: RA-HR-2026-1110
- Date: 2026-11-10
- Time to complete: 3 days (72 hours)

---

## 1. Overview — What You Must Build

Build a small, production-ready version of "Aqar Lite", a system to sell real-estate units by installments, within 3 days of receiving this document. We judge quality, accuracy and security before the number of features. A few features built professionally are better than a complete but fragile system.

- Time to complete: 3 days
- Expected effort: 12–16 hours
- Technical interview: 60 minutes
- Delivery: private GitHub repository

| Item | Details |
|---|---|
| Frontend | Next.js (App Router) + TypeScript in `strict` mode |
| Backend | Node.js: either Route Handlers / Server Actions inside Next.js, or a separate server (NestJS / Fastify / Express) |
| Database | PostgreSQL with Prisma or Drizzle, with migrations and seed |
| Run | One command: `docker compose up` |
| Delivery | Private GitHub repository shared with our team, with a README file |
| After delivery | Technical interview to review the code and make a live change to it |

**✓ Using AI tools is allowed**, if you say in the README where you used them, and you can explain and change any line in the interview.

**⚠ Some points are unclear on purpose:** if a business rule is not defined, make a reasonable decision and document it in the "Assumptions" section of the README. If you run out of time, write what you did not finish and how you would build it. This counts for you, not against you.

---

## 2. Business Scenario — One System for Many Real-Estate Companies

Many real-estate development companies use the same system (multi-tenant). No company may see another company's data under any condition. The project name is a text field on the unit. No screens are needed for projects.

### Main Flow
1. **Reservation:** the sales rep reserves an available unit for his client for 72 hours.
2. **Contract draft:** the sales rep creates the contract from the active reservation.
3. **Approval:** the accountant approves the contract, and the unit becomes sold.
4. **Installments:** the monthly installment schedule is generated automatically.
5. **Payments:** the accountant records payments, and they are allocated to the installments.

### Entities
Unit · Client · Reservation · Contract · Installment · Payment · Audit Log

### Roles and Permissions

| Role | Can | Cannot |
|---|---|---|
| Company manager | Add units and change their prices, see everything inside his company, read the audit log | Access another company's data, edit the audit log |
| Sales rep | Add his clients, reserve a unit, create a draft contract | See another rep's clients, change prices, approve a contract, record payments |
| Accountant | Approve contracts, record payments, see all contracts | Edit client or unit data, delete a payment |

**⚠ Important:** permissions are enforced on the server for every request, not only in the UI. Hiding a button in the UI is not a permission check.

---

## 3. Functional Requirements — Business Rules

Everything in this section is required, except items marked "Extra". Extra items raise the score only if the required work is complete and of good quality.

### 3.1 Authentication
- Login and logout only. No self sign-up and no user management screen.
- The seed has two companies. Each company has a manager, an accountant and two sales reps, with sample units and clients.

### 3.2 Units
- A list with server-side filtering (status, price range), pagination, and sorting by price or area.
- The manager adds and edits a unit: project, number, type, area, rooms, price.
- A unit has three statuses: `available`, `reserved` and `sold`. Only these transitions are allowed:
  - From `available` to `reserved` when it is reserved.
  - From `reserved` to `available` when the reservation expires.
  - From `reserved` to `sold` when the contract is approved.
- The price of a reserved or sold unit cannot be changed. Every price change is written to the audit log.

### 3.3 Clients
- The sales rep adds a client (name, phone, free-text notes) and edits him. A sales rep sees only his own clients.
- The notes are shown on the client page.

### 3.4 Reservations
- A reservation is valid for **72 hours**. After that, the unit becomes available again with no manual action.
- **Two sales reps reserve the same unit at the same moment:** only one succeeds, and the other gets a clear message. This must hold under real concurrent requests.

### 3.5 Contract and Installment Schedule
- The sales rep creates a draft contract from an active reservation, and the accountant approves it. After approval, the contract cannot be changed.
- The final price cannot be lower than the unit price with a maximum discount of 5%.
- The installment schedule is generated automatically: the amount left after the down payment is divided into a number of monthly installments. **The installments plus the down payment must equal the final price exactly, to the last halala.**
- A contract that starts on 31 January has its next installment due in February. Choose the logic and document it.
- The contract page shows the installment schedule, the status of each installment, and the remaining amount.

### 3.6 Payments
- The accountant records a payment of any amount. It is allocated to the oldest unpaid installments first, and each installment becomes `partial` or `paid`.
- Payments cannot be more than the remaining amount of the contract.
- **Clicking "Save" twice, or resending the request after a network failure, must not create two payments.**
- A recorded payment cannot be deleted or edited.
- An installment shows as `overdue` after its due date if it is not paid.

### 3.7 User Interface
- Arabic UI in RTL direction. It works on mobile and on large screens. A simple, clean design is enough.
- Loading, empty and error states exist. Validation messages show next to the field.

### 3.8 Extra
- One E2E test with Playwright for the flow: reservation, then contract, then approval, then payment.
- Run `lint`, `typecheck` and `test` in GitHub Actions.

**⚠ Out of scope for this test:** dashboard, export, file upload, contract cancellation, CRM stages, user management, password reset. Do not spend time on them.

---

## 4. Security Requirements (Required) — Assume the Attacker Is a Logged-In User

Assume the system goes live on the internet tomorrow, and one of the logged-in users is the attacker. We will test the system by hand and with automated tools, and we will not test only what is listed here.

### Authentication and Sessions
- Passwords are stored with bcrypt or Argon2id, and never appear in any log or response.
- The session is in a cookie with `HttpOnly`, `Secure` and a suitable `SameSite`. No tokens in `localStorage`.
- Logout really invalidates the session on the server, not only by deleting the cookie.
- Protection against password guessing, and the login error message does not reveal whether the email exists.

### Permissions and Company Isolation
- Every query is limited to the company taken from the session, not from the request. Explain in the README how you guarantee this.
- Check the role and ownership in every endpoint and every Server Action, not only at page level.
- A user cannot change fields he is not allowed to change, even if he sends them in the request by hand.

### Inputs and Outputs
- Validate every input on the server with a schema (such as Zod), including filter, sort and pagination parameters.
- No SQL queries built by joining strings, and content written by users is safe when shown.
- Error messages to the user are general. The details go only to the server logs.

### Infrastructure
- Secrets are in environment variables, with `.env.example`. No secrets in the repository, in the git history or in frontend code.
- Basic HTTP security headers, and `npm audit` with no high or critical vulnerabilities.
- The audit log covers: failed login attempts, price changes, contract approvals, payments.

**✎ "Security" section in the README:** the 3 biggest risks you see in this system, and how you handled each one.

---

## 5. Technical Requirements — Code Quality and Tests

Write the code as if you will hand it tomorrow to a colleague who will continue the work.

- **Layer separation:** installment and payment logic lives in a separate layer, not inside a React component or a route handler. TypeScript in strict mode with no `any`.
- **Money representation:** amounts are never stored as float anywhere: not in the database, not in the code, not in JSON.
- **Transactions:** contract approval and payment recording each happen inside one transaction, so data is never left half-done.
- **Database:** migrations for every change, and integrity constraints (unique, foreign keys, check) in the database itself, not only in the code.
- **Tests:** unit tests for installment generation and payment allocation, an integration test that proves access to another company is refused, and a test for concurrent reservations.
- **Professionalism:** a real git history with small, clear commits, not one huge commit at the end.

### README Content
- **Running:** clear steps from a clean machine, and seed accounts for each role.
- **Technical decisions:** what you chose, why, and which alternative you rejected.
- **Assumptions:** every unclear business rule, and how you decided to handle it.
- **Security:** the 3 biggest risks and how you handled them.
- **Not done:** honestly, and how you would build it with more time.
- **AI tools:** where you used them.

---

## 6. Delivery and Interview — What Happens After Delivery

Deliver within 72 hours of receiving this document: the link to the private repository, with a README. The project must run on a clean machine with `git clone` and then `docker compose up`. If it does not run, the evaluation stops.

### Technical Interview — 60 Minutes

| Part | Time | Content |
|---|---|---|
| Presentation | 10 minutes | You explain the structure and the most important decisions, using the code |
| Code review | 15 minutes | We ask about specific parts that we choose |
| Live change | 25 minutes | A small change you make in front of us on your project |
| Open questions | 10 minutes | Your questions about the team and the way we work |

**✦ What we look for:** we do not look for perfect code. We look for a person who knows why he wrote each line, knows where its weak points are, and treats security and financial accuracy as part of the work, not as an extra.

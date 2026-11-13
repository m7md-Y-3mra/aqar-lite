# Quickstart: Payments

Prerequisite: phase 5 merged and this branch rebased onto it.

## 1. Automated

```bash
docker compose up -d db
npm run lint && npm run typecheck && npm run test
```

Expected: allocation and schema unit tests and the payments integration tests pass ([plan rule map](./plan.md#rule--test-map)).

## 2. Record payments (accountant)

1. Log in as a seed accountant; approve a draft contract (phase 5) or open an approved one.
2. Payments section: empty state, remaining amount shown next to the amount field.
3. Pay part of the down payment → line 0 "partial", payment listed, remaining drops, toast shown, no reload.
4. Pay an amount that covers several lines → those lines "paid", the next "partial".
5. Enter more than the remaining amount → message at the top naming the remaining amount; nothing changes.
6. Pay exactly the remaining amount → all lines "paid", form replaced by "fully paid".

## 3. Repeated request

1. In DevTools, set network to offline right after pressing Save on a payment (or double-click Save).
2. Retry: only one payment appears.
3. Edit the amount and save again with the same pending key (offline case) → 409 message with the saved amount; the
   page refreshes; the next save uses a new key.

## 4. Roles

- Manager: sees the payments list, no form.
- Sales rep: sees the schedule with paid amounts and statuses, no payments section; `GET /api/contracts/{id}/payments`
  by hand → 403.
- Company B user on a company A contract URL → not found.

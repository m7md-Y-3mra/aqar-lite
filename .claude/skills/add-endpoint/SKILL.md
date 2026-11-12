---
name: add-endpoint
description: Use when adding a new API endpoint or a new read/write operation to a feature in Aqar Lite (route → service → repository, plus schema, keys and client queries). Not for UI-only changes.
---

# Add Endpoint

Builds one operation end to end, in the order of the layers in AGENTS.md.

## Inputs

You need all of these before writing code. If one is missing, ask.

- Feature (`units`, `clients`, `reservations`, `contracts`, `payments`, `audit`, `auth`)
- Operation (for example: "units: change price")
- HTTP method and path (for example: `PATCH /api/units/[id]/price`)
- Allowed roles, and the ownership rule (for example: "sales rep, own clients only")
- Business rules from `docs/brief.md` and the phase spec

## Steps (in this order)

1. **Read first.** Read AGENTS.md sections 1–7 and the existing files of the feature. Reuse what exists. Never duplicate a schema, a key or a helper.

2. **Schema** — `src/features/<f>/<f>.schemas.ts`
   - Add field rules once, if they are new.
   - Build the input schema with `.pick()`. Never `.omit()`.
   - Never include `companyId`, `salesRepId`, `userId`, `status`, `approvedAt` or `passwordHash`.
   - Query params (filter, sort, page) get a schema too. Sort fields are an allowlist.

3. **Types** — `src/features/<f>/<f>.types.ts`
   - The DTO is JSON-safe: money as integer halalas (`number`), dates as ISO strings. No `BigInt`, no `Date`.

4. **Repository** — `src/features/<f>/server/<f>.repository.ts`
   - First line: `import "server-only"`.
   - Every function takes `companyId` (required) and an optional `tx`.
   - Every query filters by `companyId`.
   - Not found → return `null` (the service turns it into `NOT_FOUND`, 404).
   - State changes use a conditional update (`WHERE status = ...` or `WHERE approvedAt IS NULL`) and return the number of changed rows.

5. **Domain** (only if there is a calculation) — `src/features/<f>/domain/<name>.ts`
   - A pure function. No imports from `server/`, Prisma or React.

6. **Service** — `src/features/<f>/server/<f>.service.ts`
   - First line: `import "server-only"`.
   - Signature: `(actor: { userId, companyId, role }, input)`. The actor comes from the session.
   - Check the role first, then ownership. Wrong role → `FORBIDDEN` (403). Other company → `NOT_FOUND` (404).
   - More than one write → `withTransaction(async (tx) => ...)`, and pass `tx` to every repository call.
   - Write the audit row when AGENTS.md requires it (price change, approval, payment, failed login).
   - Throw `AppError(code)` for every business rule. Return the DTO.
   - Never use `Request` or `Response` here.

7. **Error codes**
   - New code → `src/server/http/error-codes.ts` (with its HTTP status).
   - Its Arabic message → `src/shared/lib/error-messages.ts`.

8. **Route handler** — `src/features/<f>/server/<f>.routes.ts`
   - Use the route wrapper (session check, Origin check on writes, error mapping).
   - Parse body, query and params with the schema. Call ONE service function. Return `{ data }`.
   - Payments: read the `Idempotency-Key` header. Missing → 400.

9. **Public API** — `src/features/<f>/server/index.ts`
   - Export only the service functions that other features need.
   - Respect the direction: payments → contracts → reservations → units, clients. Never import "up".

10. **App route** — `src/app/api/<path>/route.ts`
    - One line: `export { GET, POST } from "@/features/<f>/server/<f>.routes"` (only the methods you need).

11. **Client**
    - `src/features/<f>/<f>.keys.ts`: hierarchical key factory — `all` → `lists()` → `list(filters)` → `detail(id)`.
    - `src/features/<f>/client/<f>.api.ts`: fetch functions to `/api/...`. On error, throw an error object that keeps `code` and `fieldErrors`.
    - `src/features/<f>/client/<f>.queries.ts`: reads with `queryOptions()`; writes with `useMutation` that invalidates `<f>Keys.all` and the keys of every other feature the write changes (for example: approval changes units and contracts).
    - If a page shows this data: prefetch it in `page.tsx` with the SAME key, calling the service directly.

12. **Tests**
    - Domain logic → `tests/unit/features/<f>/...`
    - Endpoint → `tests/integration/features/<f>/...` with at least: success, wrong role (403), other company (404), invalid input (400), and one test for each business rule.

13. **Finish**
    - Run `npm run lint && npm run typecheck && npm run test`, then the integration tests of this feature.
    - Commit: `feat(<f>): <operation>`.

## Checklist (all must be true)

- [ ] `companyId` and `userId` come only from the session.
- [ ] Role AND ownership are checked in the service.
- [ ] Prisma is used only in the repository.
- [ ] Multi-step writes run in one transaction.
- [ ] The prefetch and the API return the same DTO.
- [ ] Tests exist for 403, 404 and 400.

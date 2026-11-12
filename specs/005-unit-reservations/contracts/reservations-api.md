# Contract: Reservations API

Every route goes through phase 2's `handleRoute({ auth: "user" })`:
- A missing or expired session gives 401 `UNAUTHORIZED`.
- A `POST` whose `Origin` is not `APP_ORIGIN` gives 403 `INVALID_ORIGIN`.
- Success: `{ "data": … }`. Error: `{ "error": { "code", "message", "fieldErrors"? } }`, with the message in Arabic from `src/shared/lib/error-messages.ts`.

`companyId` and `salesRepId` always come from the session. They are never read from the body or the query.

## `POST /api/reservations`

Reserve a unit for one of the rep's own clients.

**Request body** (`reserveInputSchema`; extra keys are stripped):

```json
{ "unitId": "uuid", "clientId": "uuid" }
```

**201**:

```json
{ "data": {
  "id": "uuid", "reservedAt": "2026-11-12T10:00:00.000Z", "expiresAt": "2026-11-15T10:00:00.000Z",
  "unit": { "id": "uuid", "projectName": "…", "number": "…" },
  "client": { "id": "uuid", "name": "…" },
  "salesRep": { "id": "uuid", "name": "…" }
} }
```

`expiresAt − reservedAt` is exactly 72 hours (DB clock).

**Errors**:

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` + `fieldErrors.unitId` / `fieldErrors.clientId` | body not JSON; id missing or not a UUID |
| 403 | `FORBIDDEN` | role is MANAGER or ACCOUNTANT |
| 404 | `NOT_FOUND` | client not owned by the rep (another rep, another company, or missing); unit of another company or missing |
| 409 | `UNIT_NOT_AVAILABLE` | unit RESERVED by an active reservation, or SOLD; lost a race; DB overlap guard |

On any error the unit's status is unchanged.

## `GET /api/reservations?page=&pageSize=`

Active reservations, soonest expiry first.

- SALES: only rows where `salesRepId` = session user.
- MANAGER: all rows of the company.
- ACCOUNTANT: 403 `FORBIDDEN`.

**200**:

```json
{ "data": {
  "items": [ /* ReservationDto */ ],
  "total": 3, "page": 1, "pageSize": 20,
  "asOf": "2026-11-12T10:00:00.000Z"
} }
```

**Errors**: 400 (`page` < 1, `pageSize` > 50, not integers), 403 (accountant).

## `GET /api/reservations/options?unitId=`

The data for the reserve dialog. SALES only.

**200**:

```json
{ "data": {
  "unit": { "id": "uuid", "projectName": "…", "number": "…", "status": "AVAILABLE" },
  "clients": [ { "id": "uuid", "name": "…" } ]
} }
```

`clients` holds only the rep's own clients, at most 50, ordered by name. The list is empty when the rep has none.

**Errors**:

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `unitId` missing or not a UUID |
| 403 | `FORBIDDEN` | role is not SALES |
| 404 | `NOT_FOUND` | unit of another company or missing |

## Changes to the units API (phase 3)

`GET /api/units` and `GET /api/units/{id}`: each `UnitDto` gains `"reservedUntil": "ISO" | null`.
- It is an ISO string only while the unit is RESERVED by an active reservation.
- It is never accompanied by the client or the sales rep.
- The release of expired reservations runs in the same transaction as the read (research R2).

## UI contract: reserve dialog

| URL | Dialog |
|---|---|
| `/units?…` | closed |
| `/units?…&reserve=<uuid>` | open for that unit (only rendered for SALES) |
| `/units?…&reserve=not-a-uuid` | closed; the param is removed |

- Close (✕, Escape, overlay click) or success → `router.replace` to the same URL without `reserve`.
- The dialog's other states:

| State | Shown |
|---|---|
| loading options | skeleton |
| options error | error message + retry |
| unit not AVAILABLE | "هذه الوحدة لم تعد متاحة…" + close button |
| no clients | "أضف عميلاً أولاً" + link to `/clients/new` |
| form | client select (required) + "تأكيد الحجز" (disabled while pending) |
| 400 | error under the client select |
| 409 | message at the top of the form; units list refetched |
| 404 | generic not-found message at the top |
| success | toast "تم حجز الوحدة حتى <date time>"; dialog closes; units + reservations queries invalidated |

# Contract: Units API

All routes:
- Need a session (phase 2 wrapper). No session → `401 UNAUTHORIZED`.
- Return `{ data }` or `{ error: { code, message, fieldErrors? } }`. Messages are Arabic.
- Mutating routes also need `Origin` = `APP_ORIGIN`, otherwise `403 INVALID_ORIGIN`.
- Money is integer halalas. DTO shapes are in [data-model.md](../data-model.md#dtos-json-safe-same-from-the-service-and-the-api).

## GET /api/units

Lists units of the session company. Expired reservations are released first.

Query: `status`, `minPrice`, `maxPrice`, `sort` (`price|area`), `order` (`asc|desc`), `page`, `pageSize`. Rules are in data-model.md › List queries.

| Case | Status | Body |
|---|---|---|
| OK | 200 | `{ data: Page<UnitDto> }` |
| Any invalid param (bad enum, negative, non-integer, min > max, page < 1, pageSize > 50, repeated key) | 400 | `VALIDATION_ERROR` + `fieldErrors` |
| Page past the end | 200 | `items: []`, real `total` |

Roles: MANAGER, SALES, ACCOUNTANT.

## POST /api/units

Body: `{ projectName, number, type, area, rooms, price }`. Any other key is ignored (status is always AVAILABLE; the company always comes from the session).

| Case | Status | Body |
|---|---|---|
| Created | 201 | `{ data: UnitDto }` (status `AVAILABLE`) |
| Field invalid | 400 | `VALIDATION_ERROR`, `fieldErrors.<field>` |
| Same project + number in this company | 400 | `VALIDATION_ERROR`, `fieldErrors.number` |
| Role is SALES or ACCOUNTANT | 403 | `FORBIDDEN` |

No audit row.

## GET /api/units/{id}

Releases expired reservations first.

| Case | Status | Body |
|---|---|---|
| Found in session company | 200 | `{ data: UnitDto }` |
| Other company, missing, or `id` not a UUID | 404 | `NOT_FOUND` |

Roles: MANAGER, SALES, ACCOUNTANT.

## PATCH /api/units/{id}

Body: the full `{ projectName, number, type, area, rooms, price }`. `status` is ignored. The check order is 404, then 403 (research R3).

| Case | Status | Body | Audit |
|---|---|---|---|
| Other company, missing, or `id` not a UUID (any role) | 404 | `NOT_FOUND` | — |
| Role is SALES or ACCOUNTANT | 403 | `FORBIDDEN` | — |
| Field invalid | 400 | `VALIDATION_ERROR` + `fieldErrors` | — |
| Duplicate project + number | 400 | `VALIDATION_ERROR`, `fieldErrors.number` | — |
| Price unchanged, any status | 200 | `{ data: UnitDto }` | none |
| Price changed, unit AVAILABLE | 200 | `{ data: UnitDto }` | 1 × `PRICE_CHANGED` `{ oldPrice, newPrice }` |
| Price changed, unit RESERVED or SOLD (including one that became reserved after the form was opened) | 409 | `UNIT_PRICE_LOCKED` | none |
| Price changed, but another manager changed the price first | 409 | `UNIT_CHANGED` | none |

## New error codes

| Code | HTTP | Arabic message (`src/shared/lib/error-messages.ts`) |
|---|---|---|
| `UNIT_PRICE_LOCKED` | 409 | لا يمكن تغيير سعر وحدة محجوزة أو مباعة |
| `UNIT_CHANGED` | 409 | تم تعديل هذه الوحدة للتو، حدّث الصفحة وحاول مرة أخرى |

The field message for a duplicate number is `رقم الوحدة مستخدم في هذا المشروع` (in `units.schemas.ts`).

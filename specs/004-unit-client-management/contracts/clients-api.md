# Contract: Clients API

The common rules are the same as in [units-api.md](./units-api.md): session required, `{ data }` / `{ error }` shape, `Origin` check on mutations, Arabic messages.

## GET /api/clients

Query: `page`, `pageSize` (see data-model.md › List queries). Order: name ascending, then id.

| Role | Rows returned |
|---|---|
| SALES | only clients with `salesRepId = session.userId` |
| MANAGER, ACCOUNTANT | all clients of the session company |

| Case | Status | Body |
|---|---|---|
| OK | 200 | `{ data: Page<ClientDto> }` |
| Invalid `page` / `pageSize` | 400 | `VALIDATION_ERROR` + `fieldErrors` |

## POST /api/clients

Body: `{ name, phone, notes? }`. `salesRepId`, `companyId` and any other key are ignored.

| Case | Status | Body |
|---|---|---|
| Created (owner = session user) | 201 | `{ data: ClientDto }` |
| Field invalid | 400 | `VALIDATION_ERROR` + `fieldErrors` |
| Role is MANAGER or ACCOUNTANT | 403 | `FORBIDDEN` |

A phone number already used by another client is accepted. No response mentions it.

## GET /api/clients/{id}

| Case | Status | Body |
|---|---|---|
| SALES, own client | 200 | `{ data: ClientDto }` |
| SALES, another rep's client | 404 | `NOT_FOUND` |
| MANAGER / ACCOUNTANT, client of own company | 200 | `{ data: ClientDto }` |
| Other company, missing, or `id` not a UUID (any role) | 404 | `NOT_FOUND` |

## PATCH /api/clients/{id}

Body: the full `{ name, phone, notes? }`. The check order is 404, then 403 (research R3).

| Case | Status | Body |
|---|---|---|
| SALES, own client | 200 | `{ data: ClientDto }` |
| SALES, another rep's client | 404 | `NOT_FOUND` (unchanged) |
| Other company, missing, or `id` not a UUID (any role) | 404 | `NOT_FOUND` |
| MANAGER / ACCOUNTANT, client of own company | 403 | `FORBIDDEN` |
| Field invalid | 400 | `VALIDATION_ERROR` + `fieldErrors` |

The owner never changes on edit.

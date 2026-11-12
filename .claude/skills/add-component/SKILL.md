---
name: add-component
description: Use when creating a new React component, or splitting a large one, in Aqar Lite. Applies the project's component folder layout. Not for shadcn primitives in src/shared/components/ui.
---

# Add Component

## 1. Choose the location

| Used by | Location |
|---|---|
| One feature | `src/features/<f>/client/components/<name>/` |
| Only one parent component | `<parent>/components/<name>/` (max 2 nested levels) |
| Two or more features | `src/shared/components/<name>/` |

Never import a component from another feature. If a second feature needs it, move it to `src/shared/components/`.

## 2. Server or client

- Default is a Server Component.
- Add `"use client"` only if the component needs state, effects, event handlers, browser APIs, TanStack Query or React Hook Form.
- A Server Component never uses hooks and never has a `use-<name>.ts` file.

## 3. Create the folder

All names are kebab-case. The component itself is PascalCase.

```
order-summary/
├── order-summary.tsx       ← export function OrderSummary
├── use-order-summary.ts    ← client logic only (state, queries, mutations, form, handlers)
├── types.ts                ← props and local types
├── constants.ts            ← labels, options, fixed values
├── index.ts                ← public exports only
└── components/             ← private children, same layout
```

Rules:
- Create `use-<name>.ts`, `types.ts`, `constants.ts` and `components/` ONLY when they have content. No empty files.
- The `.tsx` file only renders. Logic goes in the hook.
- `index.ts` contains only:
  ```ts
  export { OrderSummary } from "./order-summary";
  export type { OrderSummaryProps } from "./types";
  ```
- Import a component through its folder (`./components/order-summary`), never its inner files.

## 4. UI rules

- Arabic text is written directly in the component. No i18n library.
- RTL: use `ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`. Never `ml-`, `mr-`, `left-`, `right-`.
- Use shadcn/ui. Tables use the plain shadcn `Table`.
- A component that shows data handles loading, empty and error states (use the shared `EmptyState` and `ErrorState`).
- User text (like client notes) is rendered as text. Never `dangerouslySetInnerHTML`.
- Never decide permissions here. Hiding a button is only for UX; the server checks.

## 5. Forms

- React Hook Form + `zodResolver` with the schema from `<f>.schemas.ts` (the same one the API uses).
- API 400 → `setError` on each field from `fieldErrors`.
- API 409 → one message at the top of the form.
- Money inputs are typed in riyals. Convert with `src/shared/lib/money.ts` only.
- Payment form: create the idempotency key once with `crypto.randomUUID()`, and make a new one only after success.

## 6. Finish

- Run `npm run lint && npm run typecheck`.
- Commit with the feature it belongs to: `feat(<f>): <what the component does>`.

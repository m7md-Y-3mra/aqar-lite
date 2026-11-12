# Contract: Login Page and App Shell UI

**Feature**: `003-auth-app-shell`

All text is Arabic. The root layout already sets `lang="ar" dir="rtl"`. Only logical spacing and position
classes are used (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`).

## Login page (`/login`)

- A centred card: the system name "عقار لايت", a short subtitle, and a form with:
  - "البريد الإلكتروني" (`type="email"`, `autocomplete="username"`, `dir="ltr"` input).
  - "كلمة المرور" (`type="password"`, `autocomplete="current-password"`).
  - The button "تسجيل الدخول".
- Field errors show under each field (`aria-invalid`, `aria-describedby`).
- The form-level error shows above the fields in an `role="alert"` box:
  - `INVALID_CREDENTIALS` → "البريد الإلكتروني أو كلمة المرور غير صحيحة"
  - Any other error or a network failure → "تعذر تسجيل الدخول، حاول مرة أخرى"
- While the request runs, the button shows "جارٍ تسجيل الدخول…" and is disabled, so a second submit is blocked.
- There are no links to sign-up, "forgot password" or user management.
- Works from 360 px wide with no horizontal scroll.

## App shell (every page in the `(app)` group)

Server layout → `AppShell` (client) with a `ShellUser` prop `{ name, role, companyName }`.

| Area | Content |
|---|---|
| Header | "عقار لايت" · company name · user name + role label · "تسجيل الخروج" button |
| Navigation | `navItemsFor(role)`: Home only in this phase; the current item has `aria-current="page"` |
| Main | The page |

- **Desktop (≥ `md`, 768 px)**: the navigation is a sidebar on the start (right) side, always visible.
- **Below `md`**: the navigation is behind a menu button (`aria-label="القائمة"`, `aria-expanded`,
  `aria-controls`). The menu opens and closes by touch, click and keyboard. Escape closes it, and so does choosing
  an item. Focus returns to the button.
- No horizontal scroll from 360 px to 1920 px.
- Logout: the button is disabled while its request runs. On success → `/login`. On failure → a `sonner` toast
  "تعذر تسجيل الخروج، حاول مرة أخرى".

## Home page (`/`)

A welcome only: "مرحبًا، {name}" with the role label and company name. No statistics, counts or summaries
(a dashboard is out of scope).

## Role labels

| Role | Label |
|---|---|
| `MANAGER` | مدير |
| `SALES` | مندوب مبيعات |
| `ACCOUNTANT` | محاسب |

## Navigation map (later phases)

Spec FR-024. An item is added to `NAV_ITEMS` only in the phase that builds its page:

| Section | href | Roles |
|---|---|---|
| الرئيسية | `/` | all |
| الوحدات | `/units` | MANAGER, SALES |
| العملاء | `/clients` | MANAGER, SALES |
| الحجوزات | `/reservations` | MANAGER, SALES |
| العقود | `/contracts` | MANAGER, SALES, ACCOUNTANT |
| سجل التدقيق | `/audit-log` | MANAGER |

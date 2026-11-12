# Contract: Seed Accounts

**Feature**: `002-schema-seed`

This table is copied into the README "Running" section. Login itself arrives in phase 2.

**Password for every account**: `AqarLite#2026` (demo value only, not a secret; stored only as an Argon2id hash).

| Company | Role | Name | Email |
|---|---|---|---|
| شركة الأفق للتطوير العقاري | Manager | مدير الأفق | `manager@ufuq.test` |
| شركة الأفق للتطوير العقاري | Accountant | محاسب الأفق | `accountant@ufuq.test` |
| شركة الأفق للتطوير العقاري | Sales rep | مندوب الأفق 1 | `sales1@ufuq.test` |
| شركة الأفق للتطوير العقاري | Sales rep | مندوب الأفق 2 | `sales2@ufuq.test` |
| شركة النخبة العقارية | Manager | مدير النخبة | `manager@nukhba.test` |
| شركة النخبة العقارية | Accountant | محاسب النخبة | `accountant@nukhba.test` |
| شركة النخبة العقارية | Sales rep | مندوب النخبة 1 | `sales1@nukhba.test` |
| شركة النخبة العقارية | Sales rep | مندوب النخبة 2 | `sales2@nukhba.test` |

- Emails use the reserved `.test` domain, so they can never reach a real mailbox.
- Company names are fictional.
- Display names can be changed during implementation; the emails, roles and password above are the contract
  (tests and the README use them).
- Each company gets 12 available units and 6 clients (3 per sales rep); see [../data-model.md](../data-model.md).

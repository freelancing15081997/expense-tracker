# 03 · API catalogue: Platform, Business, CA, Console

Conventions are in 01 §5. **Perm** is `module.action` for `require()`. "auth" means signed in only, "public" means no auth, and "sup" means super user with MFA. Every tenant-scoped route needs `X-Tenant-Id`.

Money-moving POSTs (marked 💰) **require** `Idempotency-Key`. Every other POST accepts one.

## 0. Error codes (stable `code` values)
| Group | Codes |
|---|---|
| Auth and sessions | `auth.invalid_token`, `auth.expired`, `auth.mfa_required`, `auth.step_up_required`, `auth.otp_invalid`, `auth.otp_locked`, `auth.refresh_reused` |
| Tenancy and access | `tenant.not_member`, `tenant.suspended`, `perm.denied`, `perm.over_limit`, `perm.maker_checker` |
| Requests | `validation.failed`, `conflict.state`, `conflict.version`, `conflict.duplicate`, `idempotency.mismatch`, `rate.limited`, `file.not_clean` |
| Accounting | `period.locked`, `ledger.unbalanced`, `doc.transition_not_allowed`, `doc.not_editable`, `stock.insufficient`, `payment.over_allocation` |
| Integrations | `gsp.unavailable`, `bank.unavailable` |
| Dhani | `dhani.piece_not_on_loom`, `dhani.yarn_insufficient`, `dhani.tag_not_available` |

---

# A. Platform (shared by Business, CA and Dhani)

### A1. Auth (`/v1/auth`) · public unless noted
| # | Method & path | Purpose |
|---|---|---|
| 1 | POST `/auth/firebase/exchange` | Firebase ID token → access and refresh tokens, and creates the user on first sign-in |
| 2 | POST `/auth/otp/send` | `{channel: sms\|email\|whatsapp, identifier, purpose: signin\|verify\|reset\|step_up}` |
| 3 | POST `/auth/otp/verify` | Verifies the OTP and returns tokens, or marks the identifier verified, or completes a reset or step-up |
| 4 | POST `/auth/refresh` | Rotates the refresh token (cookie or body); reuse detection |
| 5 | POST `/auth/logout` | Revokes the current session |
| 6 | POST `/auth/mfa/totp/setup` · auth | Returns `otpauth_uri` and recovery codes (once) |
| 7 | POST `/auth/mfa/totp/confirm` · auth | Enables MFA after the first code |
| 8 | DELETE `/auth/mfa/totp` · auth + step-up | Disables MFA (blocked if the role requires it) |
| 9 | POST `/auth/mfa/challenge` | Answers an MFA challenge during sign-in (TOTP or a recovery code) |
| 10 | POST `/auth/step-up` · auth | Fresh MFA/OTP → elevated token for 5 minutes |
| 11 | GET `/auth/.well-known/jwks.json` · public | Public keys (for other internal services) |

### A2. Me (`/v1/me`) · auth
| # | Method & path | Purpose |
|---|---|---|
| 12 | GET `/me` | Profile, `sup`, language, UI preferences, tenants with role and kind (`business\|practice\|dhani`) |
| 13 | PATCH `/me` | Name, phone, avatar `file_id`, `lang` (`en\|te\|ta\|kn\|hi`), `ui` (sidebar collapsed, density, last workspace) |
| 14 | GET `/me/permissions` | Effective matrix and ABAC flags for `X-Tenant-Id` |
| 15 | GET `/me/sessions` | Devices and sessions (device, IP, city, last seen, current) |
| 16 | DELETE `/me/sessions/{sid}` | Signs out one device |
| 17 | POST `/me/sessions/revoke-others` | Signs out all other devices |
| 18 | GET `/me/activity` | Own security activity (sign-ins, MFA changes, exports) |
| 19 | POST `/me/deactivate` · step-up | Deactivates the account (reversible for 30 days) |
| 20 | DELETE `/me` · step-up | Deletes the account: anonymises it and blocks it if the user is the sole Owner of a tenant |
| 21 | POST `/me/export` · step-up | Exports personal data (async → job) |

### A3. Tenants (companies, practices, Dhani businesses)
| # | Method & path | Perm |
|---|---|---|
| 22 | POST `/tenants` — `{kind, name, gstin?, state, fy_start, lang}` | auth (the creator becomes Owner) |
| 23 | GET `/tenants/current` | settings.view |
| 24 | PATCH `/tenants/current` — name, legal info, address, logo, bank, UPI | settings.edit (step-up for bank or UPI) |
| 25 | DELETE `/tenants/current` — soft delete, 30-day grace | Owner + step-up |
| 26 | POST `/tenants/current/transfer-ownership` | Owner + step-up |
| 27 | GET `/tenants/current/settings` | settings.view |
| 28 | PUT `/tenants/current/settings` — terms, e-invoice, e-way bill, TDS, round-off, reminders, Tally, feed, approvals, lock after close, date format | settings.edit |
| 29 | GET `/tenants/current/numbering` | settings.view |
| 30 | PUT `/tenants/current/numbering/{doc_type}` — prefix, next number, reset per FY | settings.edit |
| 31 | GET `/features` — tenant feature switches (the `features.ts` tree) | auth |
| 32 | PUT `/features` — cascading: turning a parent off turns its children off | roles.edit |

### A4. Members and invites
| # | Method & path | Perm |
|---|---|---|
| 33 | GET `/members?role=&status=&q=` | users.view |
| 34 | GET `/members/{uid}` — role, scope, MFA, last active, device | users.view |
| 35 | PATCH `/members/{uid}` — role, org-unit scope | users.edit + step-up for role changes |
| 36 | POST `/members/{uid}/actions/suspend` · `/restore` | users.edit |
| 37 | DELETE `/members/{uid}` — remove (not the last Owner) | users.delete |
| 38 | POST `/invites` — `{email\|phone, role_id, scope, kind: member\|ca, message}` | users.create and `can_invite` |
| 39 | GET `/invites?status=` | users.view |
| 40 | POST `/invites/{id}/actions/resend` · DELETE `/invites/{id}` (revoke) | users.create |
| 41 | GET `/invites/peek?token=` · public | Shows the tenant name, the inviter and the role |
| 42 | POST `/invites/accept` · auth — `{token}` | |
| 43 | POST `/invites/decline` · public — `{token}` | |

### A5. RBAC
| # | Method & path | Perm |
|---|---|---|
| 44 | GET `/rbac/catalog` — modules × actions, with applicability (`PAPPLY`) per tenant kind | auth |
| 45 | GET `/roles` · POST `/roles` — `{name, from_role_id?}`, which also covers "duplicate role" | roles.view / roles.create |
| 46 | GET `/roles/{id}` · PATCH `/roles/{id}` — name, description, limits (`approval_limit_paise`, `branch_scope`, `see_costs`, `see_salaries`, `see_bank_balances`, `can_invite`, `require_mfa`, `session_timeout_min`) | roles.view / roles.edit + step-up |
| 47 | PUT `/roles/{id}/permissions` — full matrix; the server applies the implied-view rule; the Owner role is locked | roles.edit + step-up |
| 48 | DELETE `/roles/{id}` — only when no members hold the role | roles.delete |
| 49 | POST `/rbac/view-as` — `{role_id\|user_id}` → read-only token for 30 minutes | roles.view + step-up (or sup) |

### A6. Files, notifications, search, undo, jobs
| # | Method & path | Perm |
|---|---|---|
| 50 | POST `/files` — `{purpose, name, mime, size, sha256}` → `{file_id, upload_url, headers}` | auth + tenant |
| 51 | POST `/files/{id}/complete` — verify and scan (async) | owner of the upload |
| 52 | GET `/files/{id}` — metadata and a 60 s download URL | the entity's view permission |
| 53 | DELETE `/files/{id}` — only if not linked to a posted record | owner or entity edit |
| 54 | GET `/notifications?unread=` · POST `/notifications/{id}/read` · POST `/notifications/read-all` | auth |
| 55 | PUT `/notifications/preferences` — per event × channel (in-app, push, email, WhatsApp) | auth |
| 56 | POST `/devices` — register an FCM token for push · DELETE `/devices/{id}` | auth |
| 57 | GET `/search?q=&types=` — command palette: records, people, pages, direct answers | per-type view (results are filtered) |
| 58 | POST `/undo/{token}` | the permission of the original action |
| 59 | GET `/jobs/{id}` — status, progress, `result_file_id`, errors | job owner |
| 60 | POST `/exports` — `{resource, filter, format: csv\|xlsx\|pdf}` → 202 | `<module>.export` |
| 61 | GET `/audit?entity_type=&entity_id=&actor=&module=&from=&to=` — change log, also used for document activity | audit.view |
| 62 | GET `/messages?entity_type=&entity_id=` — outbox log for email, WhatsApp and SMS, with delivery status | the entity's view permission |

### A7. Webhooks (inbound) · signature-verified, public
| # | Method & path | Purpose |
|---|---|---|
| 63 | POST `/webhooks/email/inbound` | Bills, payment advices and doc-request replies received by email |
| 64 | POST `/webhooks/whatsapp` | Inbound media and messages, plus delivery status |
| 65 | POST `/webhooks/email/events` | Bounces and complaints (these create a console issue) |
| 66 | POST `/webhooks/payments/{provider}` | UPI or payment-link status |
| 67 | POST `/webhooks/bank/{provider}` | Bank or Account Aggregator feed notifications |
| 68 | POST `/webhooks/gsp` | Filing, e-invoice IRN and e-way bill callbacks |

### A8. Ops · internal network only
| # | Method & path | Purpose |
|---|---|---|
| 69 | GET `/healthz` · `/readyz` · `/metrics` | Liveness; readiness (DB, Redis, bucket); Prometheus metrics |

---

# B. Business (`/v1/biz`)
Module keys are the `NAV` item keys from `constants.js`.

### B1. Home and insights
| # | Method & path | Perm |
|---|---|---|
| 70 | GET `/biz/dashboard` — KPIs, work waiting, cash and bank, receivables and payables snapshot | home.view |
| 71 | GET `/biz/analytics?range=&compare=` — revenue and expense series, margins, top customers and items | analytics.view |
| 72 | GET `/biz/cfo?months=12` — money overview: cash flow (the CF series), burn, runway, working capital | cfo.view |
| 73 | GET `/biz/watchlist` · POST `/biz/watchlist/{id}/actions/dismiss\|snooze` | control-tower.view |
| 74 | GET `/biz/insights` · POST `/biz/insights/ask` — `{question}` → natural-language answer with the source records (LLM behind a port; tenant data only) | insights.view |

### B2. Accounts (COA, ledger, periods, close)
| # | Method & path | Perm |
|---|---|---|
| 75 | GET `/biz/accounts?view=tree\|list&type=&q=&archived=` | chart-of-accounts.view |
| 76 | POST `/biz/accounts` · GET `/biz/accounts/{id}` · PATCH `/biz/accounts/{id}` | .create / .view / .edit |
| 77 | POST `/biz/accounts/{id}/actions/archive\|unarchive` — blocked if the balance isn't zero or the account is a system account | .edit |
| 78 | GET `/biz/accounts/{id}/ledger?from=&to=&cursor=` — account history with a running balance | ledger.view |
| 79 | GET `/biz/periods?fy=` | periods.view |
| 80 | POST `/biz/periods/{id}/actions/close\|lock\|reopen` — reopen needs a reason, the Owner and step-up | periods.approve |
| 81 | GET `/biz/close/{period_id}/checklist` · PATCH `/biz/close/checklist/{item_id}` — `{done, owner_id}` | close.view / close.edit |

### B3. Parties and items
| # | Method & path | Perm |
|---|---|---|
| 82 | GET `/biz/parties?kind=customer\|supplier&view=list\|groups&category=&q=&archived=` | customers.view \| vendors.view |
| 83 | POST `/biz/parties` · GET `/biz/parties/{id}` (with a balance snapshot, ageing and ship-to addresses) · PATCH | .create / .view / .edit |
| 84 | POST `/biz/parties/{id}/actions/archive\|unarchive\|merge` — merge takes `{into_id}` | .edit / .delete |
| 85 | GET `/biz/parties/{id}/statement?from=&to=&format=json\|pdf` | statements.view |
| 86 | POST `/biz/parties/{id}/statement/send` — `{channel, to}` | statements.post |
| 87 | GET `/biz/party-categories?kind=` · POST · PATCH `/{id}` | customers.edit |
| 88 | GET `/biz/lookup/gstin/{gstin}` — validate the checksum and fetch the legal name, state and status from the GSP | customers.create |
| 89 | GET `/biz/items?q=&type=goods\|service` · POST · GET `/{id}` · PATCH · POST `/{id}/actions/archive` | inventory.* |
| 90 | GET `/biz/lookup/hsn?q=` — HSN/SAC with the default GST rate | auth + tenant |

### B4. Document engine (the 14 types)
`type` ∈ `invoices, estimates, quotes, sales-orders, credit-notes, debit-notes, purchase-requests, purchase-orders, purchase-receipts, bills, vendor-credits, journals, recurring, expenses`. The module key for Perm is `type`.

| # | Method & path | Perm |
|---|---|---|
| 91 | GET `/biz/documents?type=&status=&party_id=&from=&to=&min_paise=&max_paise=&project_id=&q=&sort=` | {type}.view |
| 92 | GET `/biz/documents/counts?type=` — counts per status tab | {type}.view |
| 93 | POST `/biz/documents/calculate` — the editor preview: lines → subtotal, discount, taxable, CGST/SGST/IGST split by place of supply, round-off, TDS, net, amount in words; journals check that debits equal credits | {type}.view |
| 94 | GET `/biz/documents/next-number?type=&entity_id=` | {type}.create |
| 95 | POST `/biz/documents` — creates a draft with the full payload (party, dates, terms → due date, reference, salesperson, project, `entity_id`, tax mode, lines, discount, notes, T&C, options such as e-invoice, e-way bill, UPI link, reminders, repeat schedule, TDS/TCS, PO date, vehicle number, and narration for journals) | {type}.create |
| 96 | GET `/biz/documents/{id}?expand=party,lines,payments,links,activity,accounting` | {type}.view |
| 97 | PATCH `/biz/documents/{id}` — only fields editable in the current status; `If-Match` | {type}.edit |
| 98 | DELETE `/biz/documents/{id}` — drafts only | {type}.delete |
| 99 | POST `/biz/documents/{id}/actions/{action}` — see the action table below | per action |
| 100 | POST `/biz/documents/bulk` — `{ids, action, params}`; more than 50 ids → 202 | per action |
| 101 | GET `/biz/documents/{id}/pdf?lang=&copy=original\|duplicate` — cached by `version` | {type}.view |
| 102 | POST `/biz/documents/{id}/attachments` — `{file_id}` · DELETE `/biz/documents/{id}/attachments/{file_id}` | {type}.edit |

**Actions** (validated by the DocType state machine; each one is audited and emits `Document<Action>`; `undo_token` where it can be reversed):
| Action | Applies to | Perm action |
|---|---|---|
| `post` (approve and send, post, confirm, activate) | all | post |
| `send` / `email` `{to, cc, message}` | customer and supplier docs | post |
| `remind` | open or overdue invoices | post |
| `submit` | purchase-requests | create |
| `approve` / `reject` `{reason}` | purchase-requests and approval-gated docs | approve |
| `accept` / `decline` / `expire` | estimates, quotes | edit |
| `convert` `{to_type, line_ids?}` | quote→invoice, estimate→quote or invoice, SO→invoice, PR→PO, PO→GRN, PO or GRN→bill | create on the target |
| `receive` `{lines:[{line_id, qty}]}` | purchase-orders (partial allowed) → GRN and stock moves | create |
| `pay` 💰 `{amount_paise, date, mode, account_id, reference, tds_paise}` | invoices, bills, expenses (reimburse) | create on payments |
| `apply` `{target_doc_id, amount_paise}` | credit-notes, debit-notes, vendor-credits | post |
| `void` `{reason}` | posted docs (reverses GL and stock) | post |
| `reverse` `{date, reason}` | journals | post |
| `pause` / `resume` / `run-now` | recurring | edit |
| `duplicate` | all | create |
| `einvoice` · `cancel-einvoice` | invoices, credit and debit notes (GSP, IRN, QR) | post |
| `ewaybill` `{vehicle_no, distance_km, transporter}` | invoices, delivery | post |
| `payment-link` | invoices (UPI link and QR) | post |

### B5. Payments and collections
| # | Method & path | Perm |
|---|---|---|
| 103 | GET `/biz/payments?direction=in\|out&party_id=&from=&to=` · GET `/{id}` | invoices.view \| bills.view |
| 104 | POST `/biz/payments` 💰 — `{direction, party_id, amount_paise, date, mode, account_id, reference, allocations:[{doc_id, amount_paise, tds_paise}], unallocated_as_advance}` | invoices.create \| bills.create |
| 105 | POST `/biz/payments/{id}/actions/void` `{reason}` | .post |
| 106 | GET `/biz/receivables/aging?as_of=&bucket=30` · GET `/biz/payables/aging` | collections.view / payment-run.view |
| 107 | POST `/biz/receivables/remind` — `{party_ids \| doc_ids, channel}` | collections.post |
| 108 | POST `/biz/payment-runs` — `{bill_ids, pay_date, account_id}` · GET `/biz/payment-runs` · GET `/{id}` | payment-run.create / .view |
| 109 | POST `/biz/payment-runs/{id}/actions/submit\|approve\|reject\|execute\|export-bank-file` — execute is 💰, and step-up applies above the limit | payment-run.post / .approve |

### B6. Bank
| # | Method & path | Perm |
|---|---|---|
| 110 | GET `/biz/bank/accounts` — bank-type COA accounts with feed status and balances (masked) | banking.view |
| 111 | POST `/biz/bank/connections` `{account_id, provider}` → consent URL · GET · DELETE `/{id}` · POST `/{id}/actions/sync` | banking.edit |
| 112 | POST `/biz/bank/statements/import` — `{account_id, file_id, format: csv\|xlsx\|pdf\|mt940}` → 202 | banking.create |
| 113 | GET `/biz/bank/lines?account_id=&status=unmatched\|matched\|ignored&from=&to=` | banking.view |
| 114 | GET `/biz/bank/lines/{id}/suggestions` — scored candidates | banking.view |
| 115 | POST `/biz/bank/lines/{id}/actions/match` `{targets:[{doc_id\|payment_id, amount_paise}]}` · `unmatch` · `ignore` · `create` `{as: spend\|receipt\|payment\|transfer, …}` | banking.edit |
| 116 | POST `/biz/bank/actions/auto-match` `{account_id}` → 202 | banking.edit |
| 117 | GET `/biz/bank/rules` · POST · PATCH `/{id}` · DELETE — auto-match or categorise rules | banking.edit |
| 118 | GET `/biz/bank/reconciliation?account_id=&period_id=` · POST `/biz/bank/reconciliation/complete` | banking.view / .approve |

### B7. Operations
| # | Method & path | Perm |
|---|---|---|
| 119 | GET `/biz/stock?location_id=&status=low\|out\|in&q=` — levels and valuation | inventory.view |
| 120 | GET `/biz/stock/moves?item_id=&from=&to=` | inventory.view |
| 121 | POST `/biz/stock/adjustments` `{lines:[{item_id, location_id, qty_delta, reason}]}` · POST `/biz/stock/transfers` `{from, to, lines}` | inventory.edit |
| 122 | GET `/biz/locations` · POST · PATCH `/{id}` | inventory.edit |
| 123 | GET `/biz/assets?status=` · POST · GET `/{id}` (with schedule) · PATCH | assets.* |
| 124 | POST `/biz/assets/{id}/actions/dispose` `{date, proceeds_paise}` · POST `/biz/assets/depreciation/run` `{period_id}` (creates a journal; idempotent per period) | assets.post |
| 125 | GET `/biz/projects` · POST · GET `/{id}` (budget, spent, invoiced, margin, docs) · PATCH · POST `/{id}/actions/close` | projects.* |
| 126 | GET `/biz/budgets?fy=&org_unit_id=` (with actuals) · PUT `/biz/budgets/{fy}` `{lines:[{account_id, org_unit_id?, months[12]}]}` | budgets.view / .edit |
| 127 | GET `/biz/forecast?weeks=13` · POST `/biz/forecast/items` · PATCH `/{id}` · DELETE `/{id}` — manual inflows and outflows | forecast.view / .edit |
| 128 | GET `/biz/deals` · POST · GET `/{id}` (recognition schedule) · PATCH · POST `/{id}/actions/recognize` `{period_id}` | revenue.* |
| 129 | GET `/biz/leases` · POST · GET `/{id}` · PATCH · POST `/{id}/actions/end` | leases.* |

### B8. Tax and entities
| # | Method & path | Perm |
|---|---|---|
| 130 | GET `/biz/tax/returns?period=&type=` · GET `/biz/tax/returns/{id}` (the working) | tax.view |
| 131 | POST `/biz/tax/returns/{id}/actions/prepare` · `file` (step-up, GSP, stores the ARN) · `export` | tax.edit / tax.post / tax.export |
| 132 | POST `/biz/tax/gstr2b/actions/fetch` `{period}` → 202 · GET `/biz/tax/gstr2b/mismatches?period=&status=` | tax.edit / tax.view |
| 133 | POST `/biz/tax/gstr2b/mismatches/{id}/actions/resolve` `{action: accept_books\|accept_portal\|hold_itc\|create_bill}` | tax.edit |
| 134 | GET `/biz/tax/tds?quarter=` — deductions and challans · POST `/biz/tax/tds/challans` | tax.view / tax.edit |
| 135 | GET `/biz/gst-entities` · POST · PATCH `/{id}` · POST `/{id}/actions/make-primary` | entities.* |

### B9. Inbox, approvals, accountant, queries
| # | Method & path | Perm |
|---|---|---|
| 136 | GET `/biz/inbox?status=&kind=` · GET `/biz/inbox/{id}` (parsed fields with confidence and the file) | inbox.view |
| 137 | POST `/biz/inbox/upload` `{file_ids}` → parse (async) · GET `/biz/inbox/address` (the tenant's inbound email and WhatsApp number) | inbox.create / .view |
| 138 | POST `/biz/inbox/{id}/actions/accept` `{as: bill\|spend\|payment, overrides}` → draft doc · `reject` | inbox.edit |
| 139 | GET `/biz/approvals?status=pending\|done&mine=` · POST `/biz/approvals/{id}/actions/approve\|reject` `{reason}` | approvals.approve (with the limit checked) |
| 140 | GET `/biz/approval-rules` · PUT `/biz/approval-rules` — thresholds per doc type, amount and discount % | approvals.edit |
| 141 | GET `/biz/workbench` — the accountant's items: review flags, open queries, close status, adjustments | workbench.view |
| 142 | GET `/biz/queries?status=` · POST `/biz/queries` · POST `/biz/queries/{id}/reply` `{text, file_ids}` · POST `/{id}/actions/close` | workbench.view / .edit |
| 143 | GET `/biz/doc-requests` (requests from my CA) · POST `/biz/doc-requests/{id}/items/{item_id}/fulfil` `{file_ids}` | workbench.edit |

### B10. Reports, imports, org, integrations
| # | Method & path | Perm |
|---|---|---|
| 144 | GET `/biz/reports` — catalogue | reports.view |
| 145 | GET `/biz/reports/{key}?from=&to=&compare=&org_unit_id=&entity_id=&format=json\|csv\|xlsx\|pdf` — the keys are `trial-balance, profit-loss, balance-sheet, cash-flow, general-ledger, day-book, sales-register, purchase-register, gstr1-working, gstr3b-working, receivables-aging, payables-aging, stock-summary, stock-valuation, project-pl, budget-vs-actual, tds-summary, expense-by-category, party-ledger`; heavy reports → 202 | reports.view / .export |
| 146 | POST `/biz/imports` `{entity: parties\|items\|coa\|opening-balances\|invoices\|bills\|bank\|tally, file_id}` · GET `/{id}` | settings.edit |
| 147 | PUT `/biz/imports/{id}/mapping` · POST `/{id}/actions/validate\|commit\|undo` (undo within 24 h) | settings.edit |
| 148 | GET `/biz/org` (tree) · POST `/biz/org/units` · PATCH `/{id}` · POST `/{id}/actions/move` `{parent_id}` · `deactivate` | org.* |
| 149 | GET `/biz/integrations` · POST `/biz/integrations/{key}/connect` · DELETE `/biz/integrations/{key}` · POST `/{key}/actions/test` — for `tally, gsp, whatsapp, bank-aa, upi, email-domain` | settings.edit |

---

# C. CA practice (`/v1/ca`)
The tenant kind is `practice`. Module keys come from `NAV_CA`.

| # | Method & path | Perm |
|---|---|---|
| 150 | GET `/ca/dashboard` — clients, deadlines this week, work in progress, capacity, WIP value, overdue | ca-home.view |
| 151 | GET `/ca/clients?staff_id=&health=&type=&q=` · POST · GET `/{id}` · PATCH · POST `/{id}/actions/archive` | ca-clients.* |
| 152 | POST `/ca/clients/{id}/actions/link` `{client_tenant_id}` — sends a Byjan access request to the client Owner | ca-clients.edit |
| 153 | POST `/ca/clients/{id}/actions/open-books` → `{tenant_id, banner}`; needs an accepted CA membership; audited | ca-clients.view |
| 154 | GET `/ca/compliance?group=gst\|itr\|roc&period=&status=&client_id=&staff_id=` · GET `/ca/compliance/calendar?month=` | ca-cal.view / ca-gst\|itr\|roc.view |
| 155 | POST `/ca/compliance/generate` `{period}` — from the rule templates (`RET_T`, client type and registrations); idempotent | ca-cal.create |
| 156 | PATCH `/ca/compliance/{id}` — assignee, notes · POST `/{id}/actions/advance` `{to_status}` · `file` `{arn}` | ca-*.edit / .post |
| 157 | POST `/ca/compliance/actions/batch-file` `{ids}` → 202 | ca-*.post |
| 158 | GET `/ca/tasks?view=board&client_id=&assignee=` · POST · PATCH `/{id}` · DELETE | ca-tasks.* |
| 159 | POST `/ca/tasks/{id}/actions/move` `{column, position}` · POST `/ca/tasks/{id}/checklist` · PATCH `/ca/tasks/{id}/checklist/{item_id}` | ca-tasks.edit |
| 160 | GET `/ca/review?client_id=&issue=` · POST `/ca/review/{id}/actions/apply-fix\|dismiss\|ask-client` · POST `/ca/review/actions/scan` `{client_id}` → 202 | ca-rq.* (apply-fix writes to the client's books through membership) |
| 161 | GET `/ca/doc-requests` · POST `{client_id, items[], channel, due}` · POST `/{id}/actions/remind` · PATCH `/{id}/items/{item_id}` `{received}` | ca-docs.* |
| 162 | GET `/ca/queries?client_id=&status=` · POST · POST `/{id}/reply` · POST `/{id}/actions/close` — the same `queries` resource as B9 | ca-queries.* |
| 163 | GET `/ca/team` (capacity versus hours) · PATCH `/ca/team/{uid}` `{capacity_h, rate_paise, title}` | ca-team.view / .edit |
| 164 | GET `/ca/time?staff_id=&client_id=&from=&to=&billable=` · POST · PATCH `/{id}` · DELETE `/{id}` | ca-billing.* |
| 165 | GET `/ca/billing/wip` · POST `/ca/billing/actions/bill` 💰 `{client_id, entry_ids}` → creates an invoice in the practice's own books (B4) and marks the entries billed | ca-billing.post |
| 166 | GET `/ca/reports/{key}` — `realisation, utilisation, client-profitability, deadline-performance, wip-aging` | ca-reports.view |

---

# D. Super-user console (`/v1/console`) · sup, MFA required and IP allowlisted; every call audited with `X-Reason`
| # | Method & path |
|---|---|
| 167 | GET `/console/overview` — tenants, active users, error rate, job health, service status (the SVC list) |
| 168 | GET `/console/issues?sev=&status=&module=` · POST `/console/issues/{id}/actions/resolve\|reopen` |
| 169 | GET `/console/trace/{trace_or_issue_id}` — request timeline across logs, audit and jobs |
| 170 | GET `/console/sessions?tenant_id=&user_id=` · DELETE `/console/sessions/{sid}` |
| 171 | GET `/console/jobs?status=` · POST `/console/jobs/{id}/actions/retry\|cancel` |
| 172 | GET `/console/integrations` — health per tenant and provider |
| 173 | GET `/console/flags` · PUT `/console/flags/{key}` `{enabled, tenants?}` — `gst2, ai, wa, beta, maint, strict` |
| 174 | GET `/console/tenants?q=` · POST `/console/tenants/{id}/actions/suspend\|restore` |
| 175 | POST `/console/view-as` `{tenant_id, user_id}` → read-only token for 30 minutes (step-up) |

**Total: 175 numbered rows, which expand to about 260 operations.** Money (the personal mobile app) stays on the existing Node API and is out of scope, as the web handoff says.

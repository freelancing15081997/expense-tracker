# COVERAGE — Byjan API (Business + CA + Console + Dhani)

Source: `docs/handoff/03` + `04`. Devin E2E prompt excluded.
Implementation root: `byjan-platform/apps/backend` (strangler; not Node `/api`).

| Catalogue | Rows |
|---|---|
| Platform + Business + CA + Console | 158 |
| Dhani | 64 |
| **Total** | **222** |

| ID | Method | Path | Purpose | Handler | Tests | Status |
|---|---|---|---|---|---|---|
| 1 | POST | `/auth/firebase/exchange` | Firebase ID token → access and refresh tokens, and creates the user on first sign-in | `POST /auth/firebase/exchange` | — | partial |
| 2 | POST | `/auth/otp/send` | `{channel: sms\ | `POST /auth/otp/send` | — | partial |
| 3 | POST | `/auth/otp/verify` | Verifies the OTP and returns tokens, or marks the identifier verified, or completes a reset or step-up | `POST /auth/otp/verify` | — | partial |
| 4 | POST | `/auth/refresh` | Rotates the refresh token (cookie or body); reuse detection | `POST /auth/refresh` | — | partial |
| 5 | POST | `/auth/logout` | Revokes the current session | `POST /auth/logout` | — | partial |
| 6 | POST | `/auth/mfa/totp/setup` | Returns `otpauth_uri` and recovery codes (once) | `POST /auth/mfa/totp/setup` | — | partial |
| 7 | POST | `/auth/mfa/totp/confirm` | Enables MFA after the first code | `POST /auth/mfa/totp/confirm` | — | partial |
| 8 | DELETE | `/auth/mfa/totp` | Disables MFA (blocked if the role requires it) | `DELETE /auth/mfa/totp` | — | partial |
| 9 | POST | `/auth/mfa/challenge` | Answers an MFA challenge during sign-in (TOTP or a recovery code) | `POST /auth/mfa/challenge` | — | partial |
| 10 | POST | `/auth/step-up` | Fresh MFA/OTP → elevated token for 5 minutes | `POST /auth/step-up` | — | partial |
| 11 | GET | `/auth/.well-known/jwks.json` | Public keys (for other internal services) | `GET /auth/.well-known/jwks.json` | — | partial |
| 12 | GET | `/me` | Profile, `sup`, language, UI preferences, tenants with role and kind (`business\ | `GET /me` | — | partial |
| 13 | PATCH | `/me` | Name, phone, avatar `file_id`, `lang` (`en\ | `PATCH /me` | — | partial |
| 14 | GET | `/me/permissions` | Effective matrix and ABAC flags for `X-Tenant-Id` | `GET /me/permissions` | — | partial |
| 15 | GET | `/me/sessions` | Devices and sessions (device, IP, city, last seen, current) | `GET /me/sessions` | — | partial |
| 16 | DELETE | `/me/sessions/{sid}` | Signs out one device | — | — | missing |
| 17 | POST | `/me/sessions/revoke-others` | Signs out all other devices | `POST /me/sessions/revoke-others` | — | partial |
| 18 | GET | `/me/activity` | Own security activity (sign-ins, MFA changes, exports) | `GET /me/activity` | — | partial |
| 19 | POST | `/me/deactivate` | Deactivates the account (reversible for 30 days) | `POST /me/deactivate` | — | partial |
| 20 | DELETE | `/me` | Deletes the account: anonymises it and blocks it if the user is the sole Owner of a tenant | `DELETE /me` | — | partial |
| 21 | POST | `/me/export` | Exports personal data (async → job) | `POST /me/export` | — | partial |
| 22 | POST | `/tenants` | auth (the creator becomes Owner) | `POST /tenants` | — | partial |
| 23 | GET | `/tenants/current` | settings.view | `GET /tenants/current` | — | partial |
| 24 | PATCH | `/tenants/current` | settings.edit (step-up for bank or UPI) | `PATCH /tenants/current` | — | partial |
| 25 | DELETE | `/tenants/current` | Owner + step-up | `DELETE /tenants/current` | — | partial |
| 26 | POST | `/tenants/current/transfer-ownership` | Owner + step-up | `POST /tenants/current/transfer-ownership` | — | partial |
| 27 | GET | `/tenants/current/settings` | settings.view | `GET /tenants/current/settings` | — | partial |
| 28 | PUT | `/tenants/current/settings` | settings.edit | `PUT /tenants/current/settings` | — | partial |
| 29 | GET | `/tenants/current/numbering` | settings.view | `GET /tenants/current/numbering` | — | partial |
| 30 | PUT | `/tenants/current/numbering/{doc_type}` | settings.edit | `PUT /tenants/current/numbering/{doc_type}` | — | partial |
| 31 | GET | `/features` | auth | `GET /features` | — | partial |
| 32 | PUT | `/features` | roles.edit | `PUT /features` | — | partial |
| 33 | GET | `/members?role=&status=&q=` | users.view | — | — | missing |
| 34 | GET | `/members/{uid}` | users.view | — | — | missing |
| 35 | PATCH | `/members/{uid}` | users.edit + step-up for role changes | — | — | missing |
| 36 | POST | `/members/{uid}/actions/suspend` | users.edit | `POST /tenants/{tenant_id}/actions/suspend` | — | partial |
| 37 | DELETE | `/members/{uid}` | users.delete | — | — | missing |
| 38 | POST | `/invites` | phone, role_id, scope, kind: member\ | `POST /invites` | — | partial |
| 39 | GET | `/invites?status=` | users.view | — | — | missing |
| 40 | POST/DELETE | `/invites/{id}/actions/resend` | users.create | — | — | missing |
| 41 | GET | `/invites/peek?token=` | Shows the tenant name, the inviter and the role | — | — | missing |
| 42 | POST | `/invites/accept` |  | `POST /invites/accept` | — | partial |
| 43 | POST | `/invites/decline` |  | `POST /invites/decline` | — | partial |
| 44 | GET | `/rbac/catalog` | auth | `GET /rbac/catalog` | — | partial |
| 45 | GET/POST | `/roles` | roles.view / roles.create | — | — | missing |
| 46 | GET/PATCH | `/roles/{id}` | roles.view / roles.edit + step-up | — | — | missing |
| 47 | PUT | `/roles/{id}/permissions` | roles.edit + step-up | — | — | missing |
| 48 | DELETE | `/roles/{id}` | roles.delete | — | — | missing |
| 49 | POST | `/rbac/view-as` | user_id}` → read-only token for 30 minutes | `POST /rbac/view-as` | — | partial |
| 50 | POST | `/files` | auth + tenant | `POST /files` | — | partial |
| 51 | POST | `/files/{id}/complete` | owner of the upload | — | — | missing |
| 52 | GET | `/files/{id}` | the entity's view permission | — | — | missing |
| 53 | DELETE | `/files/{id}` | owner or entity edit | — | — | missing |
| 54 | GET/POST/POST | `/notifications?unread=` | auth | — | — | missing |
| 55 | PUT | `/notifications/preferences` | auth | `PUT /notifications/preferences` | — | partial |
| 56 | POST/DELETE | `/devices` | auth | — | — | missing |
| 57 | GET | `/search?q=&types=` | per-type view (results are filtered) | — | — | missing |
| 58 | POST | `/undo/{token}` | the permission of the original action | `POST /undo/{token}` | — | partial |
| 59 | GET | `/jobs/{id}` | job owner | — | — | missing |
| 60 | POST | `/exports` | xlsx\ | `POST /exports` | — | partial |
| 61 | GET | `/audit?entity_type=&entity_id=&actor=&module=&from=&to=` | audit.view | — | — | missing |
| 62 | GET | `/messages?entity_type=&entity_id=` | the entity's view permission | — | — | missing |
| 63 | POST | `/webhooks/email/inbound` | Bills, payment advices and doc-request replies received by email | `POST /webhooks/email/inbound` | — | partial |
| 64 | POST | `/webhooks/whatsapp` | Inbound media and messages, plus delivery status | `POST /webhooks/whatsapp` | — | partial |
| 65 | POST | `/webhooks/email/events` | Bounces and complaints (these create a console issue) | `POST /webhooks/email/events` | — | partial |
| 66 | POST | `/webhooks/payments/{provider}` | UPI or payment-link status | `POST /webhooks/payments/{provider}` | — | partial |
| 67 | POST | `/webhooks/bank/{provider}` | Bank or Account Aggregator feed notifications | `POST /webhooks/bank/{provider}` | — | partial |
| 68 | POST | `/webhooks/gsp` | Filing, e-invoice IRN and e-way bill callbacks | `POST /webhooks/gsp` | — | partial |
| 69 | GET | `/healthz` | Liveness; readiness (DB, Redis, bucket); Prometheus metrics | — | — | missing |
| 70 | GET | `/biz/dashboard` | home.view | `GET /dashboard` | — | partial |
| 71 | GET | `/biz/analytics?range=&compare=` | analytics.view | — | — | missing |
| 72 | GET | `/biz/cfo?months=12` | cfo.view | — | — | missing |
| 73 | GET/POST | `/biz/watchlist` | snooze` | — | — | missing |
| 74 | GET/POST | `/biz/insights` | insights.view | — | — | missing |
| 75 | GET | `/biz/accounts?view=tree\|list&type=&q=&archived=` | chart-of-accounts.view | — | — | missing |
| 76 | POST/GET/PATCH | `/biz/accounts` | .create / .view / .edit | — | — | missing |
| 78 | GET | `/biz/accounts/{id}/ledger?from=&to=&cursor=` | ledger.view | — | — | missing |
| 79 | GET | `/biz/periods?fy=` | periods.view | — | — | missing |
| 81 | GET/PATCH | `/biz/close/{period_id}/checklist` | close.view / close.edit | — | — | missing |
| 82 | GET | `/biz/parties?kind=customer\|supplier&view=list\|groups&category=&q=&archived=` | customers.view \ | — | — | missing |
| 83 | POST/GET/PATCH | `/biz/parties` | .create / .view / .edit | — | — | missing |
| 85 | GET | `/biz/parties/{id}/statement?from=&to=&format=json\|pdf` | statements.view | — | — | missing |
| 86 | POST | `/biz/parties/{id}/statement/send` | statements.post | `POST /parties/{id}/statement/send` | — | partial |
| 87 | GET/POST/PATCH | `/biz/party-categories?kind=` | customers.edit | — | — | missing |
| 88 | GET | `/biz/lookup/gstin/{gstin}` | customers.create | `GET /lookup/gstin/{gstin}` | — | partial |
| 90 | GET | `/biz/lookup/hsn?q=` | auth + tenant | — | — | missing |
| 91 | GET | `/biz/documents?type=&status=&party_id=&from=&to=&min_paise=&max_paise=&project_id=&q=&sort=` | {type}.view | — | — | missing |
| 92 | GET | `/biz/documents/counts?type=` | {type}.view | — | — | missing |
| 93 | POST | `/biz/documents/calculate` | {type}.view | `POST /documents/calculate` | — | partial |
| 94 | GET | `/biz/documents/next-number?type=&entity_id=` | {type}.create | — | — | missing |
| 95 | POST | `/biz/documents` | {type}.create | `POST /documents` | — | partial |
| 96 | GET | `/biz/documents/{id}?expand=party,lines,payments,links,activity,accounting` | {type}.view | — | — | missing |
| 97 | PATCH | `/biz/documents/{id}` | {type}.edit | `PATCH /documents/{id}` | — | partial |
| 98 | DELETE | `/biz/documents/{id}` | {type}.delete | `DELETE /documents/{id}` | — | partial |
| 99 | POST | `/biz/documents/{id}/actions/{action}` | per action | `POST /documents/{id}/actions/{action}` | — | partial |
| 100 | POST | `/biz/documents/bulk` | per action | `POST /documents/bulk` | — | partial |
| 102 | POST/DELETE | `/biz/documents/{id}/attachments` | {type}.edit | — | — | missing |
| 104 | POST | `/biz/payments` | invoices.create \ | `POST /payments` | — | partial |
| 105 | POST | `/biz/payments/{id}/actions/void` | .post | `POST /payments/{id}/actions/void` | — | partial |
| 106 | GET/GET | `/biz/receivables/aging?as_of=&bucket=30` | collections.view / payment-run.view | — | — | missing |
| 107 | POST | `/biz/receivables/remind` | doc_ids, channel}` | `POST /receivables/remind` | — | partial |
| 108 | POST/GET/GET | `/biz/payment-runs` | payment-run.create / .view | — | — | missing |
| 110 | GET | `/biz/bank/accounts` | banking.view | `GET /bank/accounts` | — | partial |
| 111 | POST/GET/DELETE/POST | `/biz/bank/connections` | banking.edit | — | — | missing |
| 112 | POST | `/biz/bank/statements/import` | xlsx\ | `POST /bank/statements/import` | — | partial |
| 113 | GET | `/biz/bank/lines?account_id=&status=unmatched\|matched\|ignored&from=&to=` | banking.view | — | — | missing |
| 114 | GET | `/biz/bank/lines/{id}/suggestions` | banking.view | `GET /bank/lines/{id}/suggestions` | — | partial |
| 115 | POST | `/biz/bank/lines/{id}/actions/match` | payment_id, amount_paise}]}` · `unmatch` · `ignore` · `create` `{as: spend\ | `POST /bank/lines/{id}/actions/match` | — | partial |
| 116 | POST | `/biz/bank/actions/auto-match` | banking.edit | `POST /bank/actions/auto-match` | — | partial |
| 117 | GET/POST/PATCH/DELETE | `/biz/bank/rules` | banking.edit | — | — | missing |
| 118 | GET/POST | `/biz/bank/reconciliation?account_id=&period_id=` | banking.view / .approve | — | — | missing |
| 120 | GET | `/biz/stock/moves?item_id=&from=&to=` | inventory.view | — | — | missing |
| 121 | POST/POST | `/biz/stock/adjustments` | inventory.edit | — | — | missing |
| 122 | GET/POST/PATCH | `/biz/locations` | inventory.edit | — | — | missing |
| 123 | GET/POST/GET/PATCH | `/biz/assets?status=` | assets.* | — | — | missing |
| 124 | POST/POST | `/biz/assets/{id}/actions/dispose` | assets.post | — | — | missing |
| 125 | GET/POST/GET/PATCH/POST | `/biz/projects` | projects.* | — | — | missing |
| 126 | GET/PUT | `/biz/budgets?fy=&org_unit_id=` | budgets.view / .edit | — | — | missing |
| 127 | GET/POST/PATCH/DELETE | `/biz/forecast?weeks=13` | forecast.view / .edit | — | — | missing |
| 128 | GET/POST/GET/PATCH/POST | `/biz/deals` | revenue.* | — | — | missing |
| 129 | GET/POST/GET/PATCH/POST | `/biz/leases` | leases.* | — | — | missing |
| 130 | GET/GET | `/biz/tax/returns?period=&type=` | tax.view | — | — | missing |
| 131 | POST | `/biz/tax/returns/{id}/actions/prepare` | tax.edit / tax.post / tax.export | `POST /tax/returns/{id}/actions/prepare` | — | partial |
| 132 | POST/GET | `/biz/tax/gstr2b/actions/fetch` | tax.edit / tax.view | — | — | missing |
| 133 | POST | `/biz/tax/gstr2b/mismatches/{id}/actions/resolve` | accept_portal\ | `POST /tax/gstr2b/mismatches/{id}/actions/resolve` | — | partial |
| 134 | GET/POST | `/biz/tax/tds?quarter=` | tax.view / tax.edit | — | — | missing |
| 135 | GET/POST/PATCH/POST | `/biz/gst-entities` | entities.* | — | — | missing |
| 136 | GET/GET | `/biz/inbox?status=&kind=` | inbox.view | — | — | missing |
| 137 | POST/GET | `/biz/inbox/upload` | inbox.create / .view | — | — | missing |
| 138 | POST | `/biz/inbox/{id}/actions/accept` | spend\ | `POST /inbox/{id}/actions/accept` | — | partial |
| 140 | GET/PUT | `/biz/approval-rules` | approvals.edit | — | — | missing |
| 141 | GET | `/biz/workbench` | workbench.view | `GET /workbench` | — | partial |
| 142 | GET/POST/POST/POST | `/biz/queries?status=` | workbench.view / .edit | — | — | missing |
| 143 | GET/POST | `/biz/doc-requests` | workbench.edit | — | — | missing |
| 144 | GET | `/biz/reports` | reports.view | `GET /reports` | — | partial |
| 146 | POST | `/biz/imports` | items\ | `POST /imports` | — | partial |
| 147 | PUT/POST | `/biz/imports/{id}/mapping` | commit\ | — | — | missing |
| 148 | GET/POST/PATCH/POST | `/biz/org` | org.* | — | — | missing |
| 149 | GET/POST/DELETE/POST | `/biz/integrations` | settings.edit | — | — | missing |
| 150 | GET | `/ca/dashboard` | ca-home.view | `GET /dashboard` | — | partial |
| 151 | GET/POST/GET/PATCH/POST | `/ca/clients?staff_id=&health=&type=&q=` | ca-clients.* | — | — | missing |
| 152 | POST | `/ca/clients/{id}/actions/link` | ca-clients.edit | `POST /clients/{id}/actions/link` | — | partial |
| 153 | POST | `/ca/clients/{id}/actions/open-books` | ca-clients.view | `POST /clients/{id}/actions/open-books` | — | partial |
| 155 | POST | `/ca/compliance/generate` | ca-cal.create | `POST /compliance/generate` | — | partial |
| 156 | PATCH/POST | `/ca/compliance/{id}` | ca-*.edit / .post | — | — | missing |
| 157 | POST | `/ca/compliance/actions/batch-file` | ca-*.post | `POST /compliance/actions/batch-file` | — | partial |
| 158 | GET/POST/PATCH/DELETE | `/ca/tasks?view=board&client_id=&assignee=` | ca-tasks.* | — | — | missing |
| 159 | POST/POST/PATCH | `/ca/tasks/{id}/actions/move` | ca-tasks.edit | — | — | missing |
| 160 | GET/POST | `/ca/review?client_id=&issue=` | dismiss\ | — | — | missing |
| 161 | GET/POST/POST/PATCH | `/ca/doc-requests` | ca-docs.* | — | — | missing |
| 162 | GET/POST/POST/POST | `/ca/queries?client_id=&status=` | ca-queries.* | — | — | missing |
| 163 | GET/PATCH | `/ca/team` | ca-team.view / .edit | — | — | missing |
| 164 | GET/POST/PATCH/DELETE | `/ca/time?staff_id=&client_id=&from=&to=&billable=` | ca-billing.* | — | — | missing |
| 165 | GET/POST | `/ca/billing/wip` | ca-billing.post | — | — | missing |
| 166 | GET | `/ca/reports/{key}` | ca-reports.view | `GET /reports/{key}` | — | partial |
| 168 | GET/POST | `/console/issues?sev=&status=&module=` | reopen` | — | — | missing |
| 171 | GET/POST | `/console/jobs?status=` | cancel` | — | — | missing |
| 174 | GET/POST | `/console/tenants?q=` | restore` | — | — | missing |
| D1 | GET | `/dhani/bootstrap` | One call when the app opens. Returns the masters, current rates, the user's permissions and flags, counts for the tab badges and a sync curs | — | — | missing |
| D2 | GET/POST/PATCH/POST | `/dhani/masters/{kind}` | **One generic endpoint.** `kind` is one of `colours` (name and hex), `motifs` (butta, with an SVG path or image `file_id`), `border_styles`  | — | — | missing |
| D3 | GET/GET | `/dhani/rates` | Current rates: silk ₹/kg, zari ₹/marc, dyeing per saree, kooli presets per loom type, defect cut per issue, margin % per grade (A/B/C) and p | — | — | missing |
| D4 | PUT | `/dhani/rates` | Adds a new rate version (the history is kept; old sarees keep the cost they were given). Needs step-up | — | — | missing |
| D5 | GET | `/dhani/designs?type=studio\|clone\|photo&q=&colour=&cursor=` | The design library, with thumbnail URLs | — | — | missing |
| D6 | POST | `/dhani/designs` | Creates a design. Fields: `name`; `type`; `body`, `border`, `pallu` (colour ids); `border_style` (bs); `motif` (bt); `density` (dn); `pallu_ | — | — | missing |
| D7 | GET/PATCH | `/dhani/designs/{id}` | Opens or saves in the editor (`saveEd`) | — | — | missing |
| D8 | POST | `/dhani/designs/{id}/actions/duplicate` | "Save as copy", or cloning a photo design | — | — | missing |
| D9 | POST | `/dhani/designs/{id}/actions/archive\|unarchive` | Archive. A design used in a setup can't be deleted, only archived | — | — | missing |
| D10 | GET | `/dhani/designs/{id}/usage` | Setups, sarees on looms, sold count and average price | — | — | missing |
| D11 | GET | `/dhani/setups?q=&status=draft\|ready\|in_use\|archived` | Saved lots | — | — | missing |
| D12 | POST | `/dhani/setups` | The full wizard payload. `code` (`SET-##`), `name`, `loom_type`, `design_ids[]`, `sarees[{body, border, pallu, design_id, note, photo_file_i | — | — | missing |
| D13 | GET/PATCH | `/dhani/setups/{id}` | Only while the lot isn't assigned. After assignment, only the name and notes can change | — | — | missing |
| D14 | POST | `/dhani/setups/{id}/actions/duplicate\|archive` | Copy or archive | — | — | missing |
| D15 | GET | `/dhani/weavers?status=weaving\|late\|free\|to_pay\|owes_you\|hold&village=&loom_type=&sort=next_ready\|money\|name&q=&cursor=&limit=25` | Compact rows for hundreds of looms, read from the `weaver_stats` projection. Each row has: name, village, loom, status, current saree and pr | — | — | missing |
| D16 | GET | `/dhani/weavers/counts?village=` | Counts for the filter chips | — | — | missing |
| D17 | POST/PATCH | `/dhani/weavers` | Name, `name_alt`, village, phone (encrypted), loom type and hooks, days per saree (changing it re-plans the ETAs of queued pieces), notes, p | — | — | missing |
| D18 | GET | `/dhani/weavers/{id}` | Account header: all the `wStats` figures (done, total, pending, next, earned, paid, advance, recovered, cut, kooli due, advance out, net, ya | — | — | missing |
| D19 | GET | `/dhani/weavers/{id}/pieces?state=loom\|queue\|done` | The "On loom" and "Sarees flow" tabs, with timeline, ETAs, tag and grade | — | — | missing |
| D20 | GET | `/dhani/weavers/{id}/yarn` | The Yarn tab: given, consumed, returned and held per material, plus the moves | — | — | missing |
| D21 | GET | `/dhani/weavers/{id}/money?cursor=` | The Money tab: entries and running balances | — | — | missing |
| D22 | POST | `/dhani/weavers/{id}/actions/hold\|resume` | `toggleHold`. Holding pauses the ETAs; resuming shifts them by the days held | — | — | missing |
| D23 | POST | `/dhani/weavers/{id}/actions/move-remaining` | Moves queued pieces and the loom piece to another weaver, returns the yarn and re-gives it, re-plans ETAs, and writes a single audited opera | — | — | missing |
| D24 | POST | `/dhani/weavers/{id}/actions/archive` | Only when nothing is on the loom, the yarn held is 0 and the net is 0 | `POST /parties/{id}/actions/archive` | — | partial |
| D25 | GET | `/dhani/weavers/{id}/statement?from=&to=&lang=&format=json\|pdf` | Weaver statement | — | — | missing |
| D26 | POST | `/dhani/weavers/{id}/statement/share` | sms\ | — | — | missing |
| D27 | POST | `/dhani/assignments/preview` | Returns the timeline (the queue after this weaver's pending pieces), the ETA per saree, the material to give, the cost per saree and a warni | — | — | missing |
| D28 | POST | `/dhani/assignments` | Same body as the preview, and **atomic**. Creates the pieces (the first one goes on the loom if the weaver is free), the yarn give moves (ma | — | — | missing |
| D29 | GET/GET | `/dhani/assignments?weaver_id=&setup_id=&from=` | History | — | — | missing |
| D30 | POST | `/dhani/assignments/{id}/actions/cancel` | Only for pieces not yet received. Cancels the queued pieces, records the yarn return and asks for the advance back (an entry, not a delete) | `POST /jobs/{job_id}/actions/cancel` | — | partial |
| D31 | PATCH | `/dhani/pieces/{id}` | Changes one piece before it is received | — | — | missing |
| D32 | POST | `/dhani/weavers/{id}/yarn` | return\ | — | — | missing |
| D33 | GET | `/dhani/materials/stock` | Stock in the Dhani's store per material: on hand, with weavers, and value at the current rate | `GET /stock` | — | partial |
| D34 | POST | `/dhani/materials/purchases` | Stock goes up. Writes a Kharchu ledger entry, plus a payable if it was only part-paid | — | — | missing |
| D35 | POST/GET | `/dhani/materials/adjustments` | Stock count corrections and the move history | — | — | missing |
| D36 | GET | `/dhani/receive/expected?weaver_id=&due_within_days=` | Pieces expected, used to pick the weaver. Late pieces come first | — | — | missing |
| D37 | POST | `/dhani/receipts/preview` | later}` | — | — | missing |
| D38 | POST | `/dhani/receipts` | Body: `{piece_id, colours_match, alt_colours?, defects[], grade, length_mm, deduction_paise, cut_advance, pay, mode: cash\ | — | — | missing |
| D39 | GET/GET | `/dhani/receipts?from=&to=&weaver_id=` | Receipts log | — | — | missing |
| D40 | POST | `/dhani/receipts/{id}/actions/reverse` | Only while the godown item is still in stock. Every entry is reversed with a mirror entry | — | — | missing |
| D41 | POST | `/dhani/weavers/{id}/money` | **One endpoint** for every weaver money move. `kind` values: `pay_kooli` (`payKooli`; the default amount is the kooli due, and it can't exce | — | — | missing |
| D42 | POST | `/dhani/weaver-money/{entry_id}/actions/reverse` | Mirror entry plus a mirror ledger line | — | — | missing |
| D43 | GET | `/dhani/godown?status=stock\|reserved\|sold&colour=&design_id=&weaver_id=&grade=&setup_id=&q=&cursor=&limit=24` | Godown list | — | — | missing |
| D44 | GET/GET | `/dhani/godown/counts` | Counts, plus value at cost and at list price, by colour and by design | — | — | missing |
| D45 | GET | `/dhani/godown/{tag}` | The saree sheet: design, colours, weaver, lot, grade, defects, length, a cost breakdown (silk, zari, dye, kooli; masked without `see_cost_ma | — | — | missing |
| D46 | PATCH | `/dhani/godown/{tag}` | Edit | — | — | missing |
| D47 | POST | `/dhani/godown/{tag}/actions/reserve` | An advance also writes a Jama line | — | — | missing |
| D48 | POST | `/dhani/sales` | Body: `{party_id \ | — | — | missing |
| D51 | POST | `/dhani/sales/{id}/payments` | Collects a due amount and writes Jama | `POST /payments` | — | partial |
| D52 | POST/POST | `/dhani/sales/{id}/actions/void` | Void or return. Stock comes back and the money reverses (Kharchu refund) | — | — | missing |
| D53 | POST | `/dhani/catalogues` | filter, show_price, expires_in_days}` → `{url}` · DELETE `/dhani/catalogues/{id}` | — | — | missing |
| D54 | GET | `/v1/public/catalogues/{token}` | A read-only catalogue with images and prices; items marked sold are hidden | — | — | missing |
| D55 | POST/GET | `/dhani/demand` | Logs what customers ask for (the `asked` map). Feeds the "colours in demand" tip | — | — | missing |
| D57 | GET/POST | `/dhani/parties/{id}/statement?from=&to=&format=` | out, amount_paise, mode, allocations?}` | — | — | missing |
| D58 | GET | `/dhani/ledger?dir=in\|out&from=&to=&party_id=&role=&category=&mode=&q=&group=day&cursor=` | Khatha: Jama and Kharchu grouped by day | — | — | missing |
| D59 | GET | `/dhani/ledger/summary?from=&to=` | Cash in hand per mode (cash, UPI, bank), totals of Jama and Kharchu, where Kharchu went by category (kooli, advances, yarn, zari, dyeing, ot | — | — | missing |
| D60 | POST | `/dhani/ledger` | A manual entry for other income or expenses (electricity, transport…). System-linked entries are created only by their own use cases | — | — | missing |
| D61 | GET/POST | `/dhani/ledger/{id}` | Reversal writes a mirror entry. A linked entry reverses through its source (a receipt, sale or weaver money entry) | — | — | missing |
| D62 | POST | `/dhani/cash/count` | A day-end cash count; any difference goes in as an adjustment line | — | — | missing |
| D63 | GET | `/dhani/home` | Home in one call, read from projections and cached for 30 s: today's Jama, Kharchu and received count; the saree flow (in setup, on looms, r | — | — | missing |
| D64 | GET | `/dhani/search?q=&types=` | Weavers (name, alt name, phone blind index, village), tags `S-####`, designs `DKS-`, setups `SET-`, parties, bills and ledger. Direct answer | — | — | missing |
| D65 | GET | `/dhani/reports/{key}?from=&to=&format=json\|csv\|xlsx\|pdf&lang=` | Keys: `weaver-productivity`, `kooli-register`, `advances-outstanding`, `yarn-reconciliation` (given, consumed, returned and held per weaver, | — | — | missing |
| D66 | POST | `/dhani/sync/push` | Offline queue (poor village networks). At most 200 ops. Applied in order and idempotently; returns `[{client_op_id, status: ok\ | — | — | missing |
| D67 | GET | `/dhani/sync/pull?since=&limit=500` | Change feed (entity, id, op, version, data) and `next_since` | — | — | missing |

## Summary
- partial (route decoration found): **80**
- missing: **142**
- existing `@router.*` decorations: **322**

## Existing route snapshot
- `DELETE /auth/mfa/totp`
- `DELETE /bank/connections/{id}`
- `DELETE /bank/rules/{id}`
- `DELETE /console/sessions/{session_id}`
- `DELETE /devices/{device_id}`
- `DELETE /documents/{id}`
- `DELETE /documents/{id}/attachments/{file_id}`
- `DELETE /files/{file_id}`
- `DELETE /forecast/items/{id}`
- `DELETE /integrations/{key}`
- `DELETE /invites/{invite_id}`
- `DELETE /me`
- `DELETE /me/sessions/{session_id}`
- `DELETE /members/{user_id}`
- `DELETE /roles/{role_id}`
- `DELETE /sessions/{session_id}`
- `DELETE /tasks/{id}`
- `DELETE /tenants/current`
- `DELETE /time/{id}`
- `GET /accounts`
- `GET /accounts/{id}`
- `GET /accounts/{id}/ledger`
- `GET /analytics`
- `GET /approval-rules`
- `GET /approvals`
- `GET /assets`
- `GET /assets/{id}`
- `GET /audit`
- `GET /auth/.well-known/jwks.json`
- `GET /bank/accounts`
- `GET /bank/connections/{id}`
- `GET /bank/lines`
- `GET /bank/lines/{id}/suggestions`
- `GET /bank/reconciliation`
- `GET /bank/rules`
- `GET /billing/wip`
- `GET /budgets`
- `GET /cfo`
- `GET /clients`
- `GET /clients/{id}`
- `GET /close/{period_id}/checklist`
- `GET /compliance`
- `GET /compliance/calendar`
- `GET /console/flags`
- `GET /console/integration-health`
- `GET /console/integrations`
- `GET /console/issues`
- `GET /console/jobs`
- `GET /console/overview`
- `GET /console/sessions`
- `GET /console/tenants`
- `GET /console/trace/{trace_id}`
- `GET /console/traces`
- `GET /dashboard`
- `GET /deals`
- `GET /deals/{id}`
- `GET /doc-requests`
- `GET /documents`
- `GET /documents/counts`
- `GET /documents/next-number`
- `GET /documents/{id}`
- `GET /documents/{id}/pdf`
- `GET /features`
- `GET /files/{file_id}`
- `GET /flags`
- `GET /forecast`
- `GET /gst-entities`
- `GET /health`
- `GET /imports/{id}`
- `GET /inbox`
- `GET /inbox/address`
- `GET /inbox/{id}`
- `GET /insights`
- `GET /integration-health`
- `GET /integrations`
- `GET /invites`
- `GET /invites/peek`
- `GET /issues`
- `GET /items`
- `GET /items/{id}`
- `GET /jobs`
- `GET /jobs/{job_id}`
- `GET /leases`
- `GET /leases/{id}`
- `GET /locations`
- `GET /lookup/gstin/{gstin}`
- `GET /lookup/hsn`
- `GET /me`
- `GET /me/activity`
- `GET /me/permissions`
- `GET /me/sessions`
- `GET /members`
- `GET /members/{user_id}`
- `GET /messages`
- `GET /notifications`
- `GET /org`
- `GET /overview`
- `GET /parties`
- `GET /parties/{id}`
- `GET /parties/{id}/statement`
- `GET /party-categories`
- `GET /payables/aging`
- `GET /payment-runs`
- `GET /payment-runs/{id}`
- `GET /payments`
- `GET /payments/{id}`
- `GET /periods`
- `GET /projects`
- `GET /projects/{id}`
- `GET /queries`
- `GET /rbac/catalog`
- `GET /receivables/aging`
- `GET /reports`
- `GET /reports/{key}`
- `GET /review`
- `GET /roles`
- `GET /roles/{role_id}`
- `GET /search`
- `GET /sessions`
- `GET /stock`
- `GET /stock/moves`
- `GET /tasks`
- `GET /tax/gstr2b/mismatches`
- `GET /tax/returns`
- `GET /tax/returns/{id}`
- `GET /tax/tds`
- `GET /team`
- `GET /tenants`
- `GET /tenants/current`
- `GET /tenants/current/numbering`
- `GET /tenants/current/settings`
- `GET /time`
- `GET /trace/{trace_id}`
- `GET /traces`
- `GET /watchlist`
- `GET /workbench`
- `PATCH /accounts/{id}`
- `PATCH /assets/{id}`
- `PATCH /bank/rules/{id}`
- `PATCH /clients/{id}`
- `PATCH /close/checklist/{item_id}`
- `PATCH /compliance/{id}`
- `PATCH /deals/{id}`
- `PATCH /doc-requests/{id}/items/{item_id}`
- `PATCH /documents/{id}`
- `PATCH /forecast/items/{id}`
- `PATCH /gst-entities/{id}`
- `PATCH /items/{id}`
- `PATCH /leases/{id}`
- `PATCH /locations/{id}`
- `PATCH /me`
- `PATCH /members/{user_id}`
- `PATCH /org/units/{id}`
- `PATCH /parties/{id}`
- `PATCH /party-categories/{id}`
- `PATCH /projects/{id}`
- `PATCH /roles/{role_id}`
- `PATCH /tasks/{id}`
- `PATCH /tasks/{id}/checklist/{item_id}`
- `PATCH /team/{uid}`
- `PATCH /tenants/current`
- `PATCH /time/{id}`
- `POST /accounts`
- `POST /accounts/{id}/actions/archive`
- `POST /accounts/{id}/actions/unarchive`
- `POST /approvals/{id}/actions/approve`
- `POST /approvals/{id}/actions/reject`
- `POST /assets`
- `POST /assets/depreciation/run`
- `POST /assets/{id}/actions/dispose`
- `POST /auth/firebase/exchange`
- `POST /auth/logout`
- `POST /auth/mfa/challenge`
- `POST /auth/mfa/totp/confirm`
- `POST /auth/mfa/totp/setup`
- `POST /auth/otp/send`
- `POST /auth/otp/verify`
- `POST /auth/password-reset/request`
- `POST /auth/refresh`
- `POST /auth/step-up`
- `POST /bank/actions/auto-match`
- `POST /bank/connections`
- `POST /bank/connections/{id}/actions/sync`
- `POST /bank/lines/{id}/actions/create`
- `POST /bank/lines/{id}/actions/ignore`
- `POST /bank/lines/{id}/actions/match`
- `POST /bank/lines/{id}/actions/unmatch`
- `POST /bank/reconciliation/complete`
- `POST /bank/rules`
- `POST /bank/statements/import`
- `POST /billing/actions/bill`
- `POST /clients`
- `POST /clients/{id}/actions/archive`
- `POST /clients/{id}/actions/link`
- `POST /clients/{id}/actions/open-books`
- `POST /compliance/actions/batch-file`
- `POST /compliance/generate`
- `POST /compliance/{id}/actions/advance`
- `POST /compliance/{id}/actions/file`
- `POST /console/issues/{issue_id}/actions/reopen`
- `POST /console/issues/{issue_id}/actions/resolve`
- `POST /console/jobs/{job_id}/actions/cancel`
- `POST /console/jobs/{job_id}/actions/retry`
- `POST /console/tenants/{tenant_id}/actions/restore`
- `POST /console/tenants/{tenant_id}/actions/suspend`
- `POST /console/view-as`
- `POST /deals`
- `POST /deals/{id}/actions/recognize`
- `POST /devices`
- `POST /doc-requests`
- `POST /doc-requests/{id}/actions/remind`
- `POST /doc-requests/{id}/items/{item_id}/fulfil`
- `POST /documents`
- `POST /documents/bulk`
- `POST /documents/calculate`
- `POST /documents/{id}/actions/{action}`
- `POST /documents/{id}/attachments`
- `POST /exports`
- `POST /files`
- `POST /files/{file_id}/complete`
- `POST /forecast/items`
- `POST /gst-entities`
- `POST /gst-entities/{id}/actions/make-primary`
- `POST /imports`
- `POST /imports/{id}/actions/commit`
- `POST /imports/{id}/actions/undo`
- `POST /imports/{id}/actions/validate`
- `POST /inbox/upload`
- `POST /inbox/{id}/actions/accept`
- `POST /inbox/{id}/actions/reject`
- `POST /insights/ask`
- `POST /integrations/{key}/actions/test`
- `POST /integrations/{key}/connect`
- `POST /invites`
- `POST /invites/accept`
- `POST /invites/decline`
- `POST /invites/{invite_id}/actions/resend`
- `POST /issues/{issue_id}/actions/reopen`
- `POST /issues/{issue_id}/actions/resolve`
- `POST /items`
- `POST /items/{id}/actions/archive`
- `POST /jobs/{job_id}/actions/cancel`
- `POST /jobs/{job_id}/actions/retry`
- `POST /leases`
- `POST /leases/{id}/actions/end`
- `POST /locations`
- `POST /mail/send`
- `POST /me/deactivate`
- `POST /me/export`
- `POST /me/sessions/revoke-others`
- `POST /members/{user_id}/actions/restore`
- `POST /members/{user_id}/actions/suspend`
- `POST /notifications/read-all`
- `POST /notifications/{notification_id}/read`
- `POST /org/units`
- `POST /org/units/{id}/actions/deactivate`
- `POST /org/units/{id}/actions/move`
- `POST /parties`
- `POST /parties/{id}/actions/archive`
- `POST /parties/{id}/actions/merge`
- `POST /parties/{id}/actions/unarchive`
- `POST /parties/{id}/statement/send`
- `POST /party-categories`
- `POST /payment-runs`
- `POST /payment-runs/{id}/actions/approve`
- `POST /payment-runs/{id}/actions/execute`
- `POST /payment-runs/{id}/actions/export-bank-file`
- `POST /payment-runs/{id}/actions/reject`
- `POST /payment-runs/{id}/actions/submit`
- `POST /payments`
- `POST /payments/{id}/actions/void`
- `POST /periods/{id}/actions/close`
- `POST /periods/{id}/actions/lock`
- `POST /periods/{id}/actions/reopen`
- `POST /projects`
- `POST /projects/{id}/actions/close`
- `POST /queries`
- `POST /queries/{id}/actions/close`
- `POST /queries/{id}/reply`
- `POST /rbac/view-as`
- `POST /receivables/remind`
- `POST /review/actions/scan`
- `POST /review/{id}/actions/apply-fix`
- `POST /review/{id}/actions/ask-client`
- `POST /review/{id}/actions/dismiss`
- `POST /roles`
- `POST /stock/adjustments`
- `POST /stock/transfers`
- `POST /tasks`
- `POST /tasks/{id}/actions/move`
- `POST /tasks/{id}/checklist`
- `POST /tax/gstr2b/actions/fetch`
- `POST /tax/gstr2b/mismatches/{id}/actions/resolve`
- `POST /tax/returns/{id}/actions/export`
- `POST /tax/returns/{id}/actions/file`
- `POST /tax/returns/{id}/actions/prepare`
- `POST /tax/tds/challans`
- `POST /tenants`
- `POST /tenants/current/transfer-ownership`
- `POST /tenants/{tenant_id}/actions/restore`
- `POST /tenants/{tenant_id}/actions/suspend`
- `POST /time`
- `POST /undo/{token}`
- `POST /view-as`
- `POST /watchlist/{id}/actions/dismiss`
- `POST /watchlist/{id}/actions/snooze`
- `POST /webhooks/bank/{provider}`
- `POST /webhooks/email/events`
- `POST /webhooks/email/inbound`
- `POST /webhooks/gsp`
- `POST /webhooks/payments/{provider}`
- `POST /webhooks/whatsapp`
- `PUT /approval-rules`
- `PUT /budgets/{fy}`
- `PUT /console/flags/{key}`
- `PUT /features`
- `PUT /flags/{key}`
- `PUT /imports/{id}/mapping`
- `PUT /notifications/preferences`
- `PUT /roles/{role_id}/permissions`
- `PUT /tenants/current/numbering/{doc_type}`
- `PUT /tenants/current/settings`

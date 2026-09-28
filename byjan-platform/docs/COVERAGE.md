# Byjan Business Backend - API Coverage Tracker

**Scope:** Byjan Business + CA Practice + Super-User Console (175 endpoints, ~260 operations)
**Excluded:** Dhani Khatha (per user request)
**Status:** Phase 0 - Planning

---

## Legend
- ✅ Implemented with tests
- 🚧 In progress
- ⏳ Not started
- 📝 Spec exists, not coded

---

# A. Platform (Shared by Business, CA, Console)
**Total:** 69 endpoints (rows 1-69 from spec)

### A1. Auth (`/v1/auth`)
| # | Endpoint | Handler | Tests | Status |
|---|----------|---------|-------|--------|
| 1 | POST `/auth/firebase/exchange` | | | ⏳ |
| 2 | POST `/auth/otp/send` | | | ⏳ |
| 3 | POST `/auth/otp/verify` | | | ⏳ |
| 4 | POST `/auth/refresh` | | | ⏳ |
| 5 | POST `/auth/logout` | | | ⏳ |
| 6 | POST `/auth/mfa/totp/setup` | | | ⏳ |
| 7 | POST `/auth/mfa/totp/confirm` | | | ⏳ |
| 8 | DELETE `/auth/mfa/totp` | | | ⏳ |
| 9 | POST `/auth/mfa/challenge` | | | ⏳ |
| 10 | POST `/auth/step-up` | | | ⏳ |
| 11 | GET `/auth/.well-known/jwks.json` | | | ⏳ |

### A2. Me (`/v1/me`)
| # | Endpoint | Handler | Tests | Status |
|---|----------|---------|-------|--------|
| 12 | GET `/me` | | | ⏳ |
| 13 | PATCH `/me` | | | ⏳ |
| 14 | GET `/me/permissions` | | | ⏳ |
| 15 | GET `/me/sessions` | | | ⏳ |
| 16 | DELETE `/me/sessions/{sid}` | | | ⏳ |
| 17 | POST `/me/sessions/revoke-others` | | | ⏳ |
| 18 | GET `/me/activity` | | | ⏳ |
| 19 | POST `/me/deactivate` | | | ⏳ |
| 20 | DELETE `/me` | | | ⏳ |
| 21 | POST `/me/export` | | | ⏳ |

### A3. Tenants
| # | Endpoint | Handler | Tests | Status |
|---|----------|---------|-------|--------|
| 22 | POST `/tenants` | | | ⏳ |
| 23 | GET `/tenants/current` | | | ⏳ |
| 24 | PATCH `/tenants/current` | | | ⏳ |
| 25 | DELETE `/tenants/current` | | | ⏳ |
| 26 | POST `/tenants/current/transfer-ownership` | | | ⏳ |
| 27 | GET `/tenants/current/settings` | | | ⏳ |
| 28 | PUT `/tenants/current/settings` | | | ⏳ |
| 29 | GET `/tenants/current/numbering` | | | ⏳ |
| 30 | PUT `/tenants/current/numbering/{doc_type}` | | | ⏳ |
| 31 | GET `/features` | | | ⏳ |
| 32 | PUT `/features` | | | ⏳ |

### A4. Members and Invites
| # | Endpoint | Handler | Tests | Status |
|---|----------|---------|-------|--------|
| 33 | GET `/members` | | | ⏳ |
| 34 | GET `/members/{uid}` | | | ⏳ |
| 35 | PATCH `/members/{uid}` | | | ⏳ |
| 36 | POST `/members/{uid}/actions/suspend` | | | ⏳ |
| 37 | DELETE `/members/{uid}` | | | ⏳ |
| 38 | POST `/invites` | | | ⏳ |
| 39 | GET `/invites` | | | ⏳ |
| 40 | POST `/invites/{id}/actions/resend` | | | ⏳ |
| 41 | GET `/invites/peek` | | | ⏳ |
| 42 | POST `/invites/accept` | | | ⏳ |
| 43 | POST `/invites/decline` | | | ⏳ |

### A5. RBAC
| # | Endpoint | Handler | Tests | Status |
|---|----------|---------|-------|--------|
| 44 | GET `/rbac/catalog` | | | ⏳ |
| 45 | GET `/roles` | | | ⏳ |
| 46 | POST `/roles` | | | ⏳ |
| 47 | GET `/roles/{id}` | | | ⏳ |
| 48 | PATCH `/roles/{id}` | | | ⏳ |
| 49 | PUT `/roles/{id}/permissions` | | | ⏳ |
| 50 | DELETE `/roles/{id}` | | | ⏳ |
| 51 | POST `/rbac/view-as` | | | ⏳ |

### A6. Files, Notifications, Search, Undo, Jobs
| # | Endpoint | Handler | Tests | Status |
|---|----------|---------|-------|--------|
| 52 | POST `/files` | | | ⏳ |
| 53 | POST `/files/{id}/complete` | | | ⏳ |
| 54 | GET `/files/{id}` | | | ⏳ |
| 55 | DELETE `/files/{id}` | | | ⏳ |
| 56 | GET `/notifications` | | | ⏳ |
| 57 | POST `/notifications/{id}/read` | | | ⏳ |
| 58 | POST `/notifications/read-all` | | | ⏳ |
| 59 | PUT `/notifications/preferences` | | | ⏳ |
| 60 | POST `/devices` | | | ⏳ |
| 61 | DELETE `/devices/{id}` | | | ⏳ |
| 62 | GET `/search` | | | ⏳ |
| 63 | POST `/undo/{token}` | | | ⏳ |
| 64 | GET `/jobs/{id}` | | | ⏳ |
| 65 | POST `/exports` | | | ⏳ |
| 66 | GET `/audit` | | | ⏳ |
| 67 | GET `/messages` | | | ⏳ |

### A7. Webhooks (Inbound)
| # | Endpoint | Handler | Tests | Status |
|---|----------|---------|-------|--------|
| 68 | POST `/webhooks/email/inbound` | | | ⏳ |
| 69 | POST `/webhooks/whatsapp` | | | ⏳ |
| 70 | POST `/webhooks/email/events` | | | ⏳ |
| 71 | POST `/webhooks/payments/{provider}` | | | ⏳ |
| 72 | POST `/webhooks/bank/{provider}` | | | ⏳ |
| 73 | POST `/webhooks/gsp` | | | ⏳ |

### A8. Ops
| # | Endpoint | Handler | Tests | Status |
|---|----------|---------|-------|--------|
| 74 | GET `/healthz` | | | ⏳ |
| 75 | GET `/readyz` | | | ⏳ |
| 76 | GET `/metrics` | | | ⏳ |

---

# B. Business (`/v1/biz`)
**Total:** 80 endpoints (rows 70-149 from spec)

### B1. Home and Insights
| # | Endpoint | Handler | Tests | Status |
|---|----------|---------|-------|--------|
| 77 | GET `/biz/dashboard` | | | ⏳ |
| 78 | GET `/biz/analytics` | | | ⏳ |
| 79 | GET `/biz/cfo` | | | ⏳ |
| 80 | GET `/biz/watchlist` | | | ⏳ |
| 81 | GET `/biz/insights` | | | ⏳ |
| 82 | POST `/biz/insights/ask` | | | ⏳ |

### B2. Accounts (COA, Ledger, Periods)
| # | Endpoint | Handler | Tests | Status |
|---|----------|---------|-------|--------|
| 83 | GET `/biz/accounts` | | | ⏳ |
| 84 | POST `/biz/accounts` | | | ⏳ |
| 85 | GET `/biz/accounts/{id}` | | | ⏳ |
| 86 | PATCH `/biz/accounts/{id}` | | | ⏳ |
| 87 | POST `/biz/accounts/{id}/actions/archive` | | | ⏳ |
| 88 | POST `/biz/accounts/{id}/actions/unarchive` | | | ⏳ |
| 89 | GET `/biz/accounts/{id}/ledger` | | | ⏳ |
| 90 | GET `/biz/periods` | | | ⏳ |
| 91 | POST `/biz/periods/{id}/actions/close` | | | ⏳ |
| 92 | POST `/biz/periods/{id}/actions/lock` | | | ⏳ |
| 93 | POST `/biz/periods/{id}/actions/reopen` | | | ⏳ |
| 94 | GET `/biz/close/{period_id}/checklist` | | | ⏳ |
| 95 | PATCH `/biz/close/checklist/{item_id}` | | | ⏳ |

### B3. Parties and Items
| # | Endpoint | Handler | Tests | Status |
|---|----------|---------|-------|--------|
| 96 | GET `/biz/parties` | | | ⏳ |
| 97 | POST `/biz/parties` | | | ⏳ |
| 98 | GET `/biz/parties/{id}` | | | ⏳ |
| 99 | PATCH `/biz/parties/{id}` | | | ⏳ |
| 100 | POST `/biz/parties/{id}/actions/archive` | | | ⏳ |
| 101 | POST `/biz/parties/{id}/actions/unarchive` | | | ⏳ |
| 102 | POST `/biz/parties/{id}/actions/merge` | | | ⏳ |
| 103 | GET `/biz/parties/{id}/statement` | | | ⏳ |
| 104 | POST `/biz/parties/{id}/statement/send` | | | ⏳ |
| 105 | GET `/biz/party-categories` | | | ⏳ |
| 106 | POST `/biz/party-categories` | | | ⏳ |
| 107 | PATCH `/biz/party-categories/{id}` | | | ⏳ |
| 108 | GET `/biz/lookup/gstin/{gstin}` | | | ⏳ |
| 109 | GET `/biz/items` | | | ⏳ |
| 110 | POST `/biz/items` | | | ⏳ |
| 111 | GET `/biz/items/{id}` | | | ⏳ |
| 112 | PATCH `/biz/items/{id}` | | | ⏳ |
| 113 | POST `/biz/items/{id}/actions/archive` | | | ⏳ |
| 114 | GET `/biz/lookup/hsn` | | | ⏳ |

### B4. Document Engine (14 Types)
| # | Endpoint | Handler | Tests | Status |
|---|----------|---------|-------|--------|
| 115 | GET `/biz/documents` | | | ⏳ |
| 116 | GET `/biz/documents/counts` | | | ⏳ |
| 117 | POST `/biz/documents/calculate` | | | ⏳ |
| 118 | GET `/biz/documents/next-number` | | | ⏳ |
| 119 | POST `/biz/documents` | | | ⏳ |
| 120 | GET `/biz/documents/{id}` | | | ⏳ |
| 121 | PATCH `/biz/documents/{id}` | | | ⏳ |
| 122 | DELETE `/biz/documents/{id}` | | | ⏳ |
| 123 | POST `/biz/documents/{id}/actions/{action}` | | | ⏳ |
| 124 | POST `/biz/documents/bulk` | | | ⏳ |
| 125 | GET `/biz/documents/{id}/pdf` | | | ⏳ |
| 126 | POST `/biz/documents/{id}/attachments` | | | ⏳ |
| 127 | DELETE `/biz/documents/{id}/attachments/{file_id}` | | | ⏳ |

**Document Actions (16 actions per type):**
- post, send, remind, submit, approve, reject, accept, decline, expire, convert, receive, pay, apply, void, reverse, pause, resume, run-now, duplicate, einvoice, cancel-einvoice, ewaybill, payment-link

### B5. Payments and Collections
| # | Endpoint | Handler | Tests | Status |
|---|----------|---------|-------|--------|
| 128 | GET `/biz/payments` | | | ⏳ |
| 129 | GET `/biz/payments/{id}` | | | ⏳ |
| 130 | POST `/biz/payments` | | | ⏳ |
| 131 | POST `/biz/payments/{id}/actions/void` | | | ⏳ |
| 132 | GET `/biz/receivables/aging` | | | ⏳ |
| 133 | GET `/biz/payables/aging` | | | ⏳ |
| 134 | POST `/biz/receivables/remind` | | | ⏳ |
| 135 | POST `/biz/payment-runs` | | | ⏳ |
| 136 | GET `/biz/payment-runs` | | | ⏳ |
| 137 | GET `/biz/payment-runs/{id}` | | | ⏳ |
| 138 | POST `/biz/payment-runs/{id}/actions/submit` | | | ⏳ |
| 139 | POST `/biz/payment-runs/{id}/actions/approve` | | | ⏳ |
| 140 | POST `/biz/payment-runs/{id}/actions/reject` | | | ⏳ |
| 141 | POST `/biz/payment-runs/{id}/actions/execute` | | | ⏳ |
| 142 | POST `/biz/payment-runs/{id}/actions/export-bank-file` | | | ⏳ |

### B6. Bank
| # | Endpoint | Handler | Tests | Status |
|---|----------|---------|-------|--------|
| 143 | GET `/biz/bank/accounts` | | | ⏳ |
| 144 | POST `/biz/bank/connections` | | | ⏳ |
| 145 | GET `/biz/bank/connections/{id}` | | | ⏳ |
| 146 | DELETE `/biz/bank/connections/{id}` | | | ⏳ |
| 147 | POST `/biz/bank/connections/{id}/actions/sync` | | | ⏳ |
| 148 | POST `/biz/bank/statements/import` | | | ⏳ |
| 149 | GET `/biz/bank/lines` | | | ⏳ |
| 150 | GET `/biz/bank/lines/{id}/suggestions` | | | ⏳ |
| 151 | POST `/biz/bank/lines/{id}/actions/match` | | | ⏳ |
| 152 | POST `/biz/bank/lines/{id}/actions/unmatch` | | | ⏳ |
| 153 | POST `/biz/bank/lines/{id}/actions/ignore` | | | ⏳ |
| 154 | POST `/biz/bank/lines/{id}/actions/create` | | | ⏳ |
| 155 | POST `/biz/bank/actions/auto-match` | | | ⏳ |
| 156 | GET `/biz/bank/rules` | | | ⏳ |
| 157 | POST `/biz/bank/rules` | | | ⏳ |
| 158 | PATCH `/biz/bank/rules/{id}` | | | ⏳ |
| 159 | DELETE `/biz/bank/rules/{id}` | | | ⏳ |
| 160 | GET `/biz/bank/reconciliation` | | | ⏳ |
| 161 | POST `/biz/bank/reconciliation/complete` | | | ⏳ |

### B7. Operations
| # | Endpoint | Handler | Tests | Status |
|---|----------|---------|-------|--------|
| 162 | GET `/biz/stock` | | | ⏳ |
| 163 | GET `/biz/stock/moves` | | | ⏳ |
| 164 | POST `/biz/stock/adjustments` | | | ⏳ |
| 165 | POST `/biz/stock/transfers` | | | ⏳ |
| 166 | GET `/biz/locations` | | | ⏳ |
| 167 | POST `/biz/locations` | | | ⏳ |
| 168 | PATCH `/biz/locations/{id}` | | | ⏳ |
| 169 | GET `/biz/assets` | | | ⏳ |
| 170 | POST `/biz/assets` | | | ⏳ |
| 171 | GET `/biz/assets/{id}` | | | ⏳ |
| 172 | PATCH `/biz/assets/{id}` | | | ⏳ |
| 173 | POST `/biz/assets/{id}/actions/dispose` | | | ⏳ |
| 174 | POST `/biz/assets/depreciation/run` | | | ⏳ |
| 175 | GET `/biz/projects` | | | ⏳ |
| 176 | POST `/biz/projects` | | | ⏳ |
| 177 | GET `/biz/projects/{id}` | | | ⏳ |
| 178 | PATCH `/biz/projects/{id}` | | | ⏳ |
| 179 | POST `/biz/projects/{id}/actions/close` | | | ⏳ |
| 180 | GET `/biz/budgets` | | | ⏳ |
| 181 | PUT `/biz/budgets/{fy}` | | | ⏳ |
| 182 | GET `/biz/forecast` | | | ⏳ |
| 183 | POST `/biz/forecast/items` | | | ⏳ |
| 184 | PATCH `/biz/forecast/items/{id}` | | | ⏳ |
| 185 | DELETE `/biz/forecast/items/{id}` | | | ⏳ |
| 186 | GET `/biz/deals` | | | ⏳ |
| 187 | POST `/biz/deals` | | | ⏳ |
| 188 | GET `/biz/deals/{id}` | | | ⏳ |
| 189 | PATCH `/biz/deals/{id}` | | | ⏳ |
| 190 | POST `/biz/deals/{id}/actions/recognize` | | | ⏳ |
| 191 | GET `/biz/leases` | | | ⏳ |
| 192 | POST `/biz/leases` | | | ⏳ |
| 193 | GET `/biz/leases/{id}` | | | ⏳ |
| 194 | PATCH `/biz/leases/{id}` | | | ⏳ |
| 195 | POST `/biz/leases/{id}/actions/end` | | | ⏳ |

### B8. Tax and Entities
| # | Endpoint | Handler | Tests | Status |
|---|----------|---------|-------|--------|
| 196 | GET `/biz/tax/returns` | | | ⏳ |
| 197 | GET `/biz/tax/returns/{id}` | | | ⏳ |
| 198 | POST `/biz/tax/returns/{id}/actions/prepare` | | | ⏳ |
| 199 | POST `/biz/tax/returns/{id}/actions/file` | | | ⏳ |
| 200 | POST `/biz/tax/returns/{id}/actions/export` | | | ⏳ |
| 201 | POST `/biz/tax/gstr2b/actions/fetch` | | | ⏳ |
| 202 | GET `/biz/tax/gstr2b/mismatches` | | | ⏳ |
| 203 | POST `/biz/tax/gstr2b/mismatches/{id}/actions/resolve` | | | ⏳ |
| 204 | GET `/biz/tax/tds` | | | ⏳ |
| 205 | POST `/biz/tax/tds/challans` | | | ⏳ |
| 206 | GET `/biz/gst-entities` | | | ⏳ |
| 207 | POST `/biz/gst-entities` | | | ⏳ |
| 208 | PATCH `/biz/gst-entities/{id}` | | | ⏳ |
| 209 | POST `/biz/gst-entities/{id}/actions/make-primary` | | | ⏳ |

### B9. Inbox, Approvals, Accountant, Queries
| # | Endpoint | Handler | Tests | Status |
|---|----------|---------|-------|--------|
| 210 | GET `/biz/inbox` | | | ⏳ |
| 211 | GET `/biz/inbox/{id}` | | | ⏳ |
| 212 | POST `/biz/inbox/upload` | | | ⏳ |
| 213 | GET `/biz/inbox/address` | | | ⏳ |
| 214 | POST `/biz/inbox/{id}/actions/accept` | | | ⏳ |
| 215 | POST `/biz/inbox/{id}/actions/reject` | | | ⏳ |
| 216 | GET `/biz/approvals` | | | ⏳ |
| 217 | POST `/biz/approvals/{id}/actions/approve` | | | ⏳ |
| 218 | POST `/biz/approvals/{id}/actions/reject` | | | ⏳ |
| 219 | GET `/biz/approval-rules` | | | ⏳ |
| 220 | PUT `/biz/approval-rules` | | | ⏳ |
| 221 | GET `/biz/workbench` | | | ⏳ |
| 222 | GET `/biz/queries` | | | ⏳ |
| 223 | POST `/biz/queries` | | | ⏳ |
| 224 | POST `/biz/queries/{id}/reply` | | | ⏳ |
| 225 | POST `/biz/queries/{id}/actions/close` | | | ⏳ |
| 226 | GET `/biz/doc-requests` | | | ⏳ |
| 227 | POST `/biz/doc-requests/{id}/items/{item_id}/fulfil` | | | ⏳ |

### B10. Reports, Imports, Org, Integrations
| # | Endpoint | Handler | Tests | Status |
|---|----------|---------|-------|--------|
| 228 | GET `/biz/reports` | | | ⏳ |
| 229 | GET `/biz/reports/{key}` | | | ⏳ |
| 230 | POST `/biz/imports` | | | ⏳ |
| 231 | GET `/biz/imports/{id}` | | | ⏳ |
| 232 | PUT `/biz/imports/{id}/mapping` | | | ⏳ |
| 233 | POST `/biz/imports/{id}/actions/validate` | | | ⏳ |
| 234 | POST `/biz/imports/{id}/actions/commit` | | | ⏳ |
| 235 | POST `/biz/imports/{id}/actions/undo` | | | ⏳ |
| 236 | GET `/biz/org` | | | ⏳ |
| 237 | POST `/biz/org/units` | | | ⏳ |
| 238 | PATCH `/biz/org/units/{id}` | | | ⏳ |
| 239 | POST `/biz/org/units/{id}/actions/move` | | | ⏳ |
| 240 | POST `/biz/org/units/{id}/actions/deactivate` | | | ⏳ |
| 241 | GET `/biz/integrations` | | | ⏳ |
| 242 | POST `/biz/integrations/{key}/connect` | | | ⏳ |
| 243 | DELETE `/biz/integrations/{key}` | | | ⏳ |
| 244 | POST `/biz/integrations/{key}/actions/test` | | | ⏳ |

---

# C. CA Practice (`/v1/ca`)
**Total:** 17 endpoints (rows 150-166 from spec)

| # | Endpoint | Handler | Tests | Status |
|---|----------|---------|-------|--------|
| 245 | GET `/ca/dashboard` | | | ⏳ |
| 246 | GET `/ca/clients` | | | ⏳ |
| 247 | POST `/ca/clients` | | | ⏳ |
| 248 | GET `/ca/clients/{id}` | | | ⏳ |
| 249 | PATCH `/ca/clients/{id}` | | | ⏳ |
| 250 | POST `/ca/clients/{id}/actions/archive` | | | ⏳ |
| 251 | POST `/ca/clients/{id}/actions/link` | | | ⏳ |
| 252 | POST `/ca/clients/{id}/actions/open-books` | | | ⏳ |
| 253 | GET `/ca/compliance` | | | ⏳ |
| 254 | GET `/ca/compliance/calendar` | | | ⏳ |
| 255 | POST `/ca/compliance/generate` | | | ⏳ |
| 256 | PATCH `/ca/compliance/{id}` | | | ⏳ |
| 257 | POST `/ca/compliance/{id}/actions/advance` | | | ⏳ |
| 258 | POST `/ca/compliance/{id}/actions/file` | | | ⏳ |
| 259 | POST `/ca/compliance/actions/batch-file` | | | ⏳ |
| 260 | GET `/ca/tasks` | | | ⏳ |
| 261 | POST `/ca/tasks` | | | ⏳ |
| 262 | PATCH `/ca/tasks/{id}` | | | ⏳ |
| 263 | DELETE `/ca/tasks/{id}` | | | ⏳ |
| 264 | POST `/ca/tasks/{id}/actions/move` | | | ⏳ |
| 265 | POST `/ca/tasks/{id}/checklist` | | | ⏳ |
| 266 | PATCH `/ca/tasks/{id}/checklist/{item_id}` | | | ⏳ |
| 267 | GET `/ca/review` | | | ⏳ |
| 268 | POST `/ca/review/{id}/actions/apply-fix` | | | ⏳ |
| 269 | POST `/ca/review/{id}/actions/dismiss` | | | ⏳ |
| 270 | POST `/ca/review/{id}/actions/ask-client` | | | ⏳ |
| 271 | POST `/ca/review/actions/scan` | | | ⏳ |
| 272 | GET `/ca/doc-requests` | | | ⏳ |
| 273 | POST `/ca/doc-requests` | | | ⏳ |
| 274 | POST `/ca/doc-requests/{id}/actions/remind` | | | ⏳ |
| 275 | PATCH `/ca/doc-requests/{id}/items/{item_id}` | | | ⏳ |
| 276 | GET `/ca/queries` | | | ⏳ |
| 277 | POST `/ca/queries` | | | ⏳ |
| 278 | POST `/ca/queries/{id}/reply` | | | ⏳ |
| 279 | POST `/ca/queries/{id}/actions/close` | | ⏳ |
| 280 | GET `/ca/team` | | | ⏳ |
| 281 | PATCH `/ca/team/{uid}` | | | ⏳ |
| 282 | GET `/ca/time` | | | ⏳ |
| 283 | POST `/ca/time` | | | ⏳ |
| 284 | PATCH `/ca/time/{id}` | | | ⏳ |
| 285 | DELETE `/ca/time/{id}` | | | ⏳ |
| 286 | GET `/ca/billing/wip` | | | ⏳ |
| 287 | POST `/ca/billing/actions/bill` | | | ⏳ |
| 288 | GET `/ca/reports/{key}` | | | ⏳ |

---

# D. Super-User Console (`/v1/console`)
**Total:** 9 endpoints (rows 167-175 from spec)

| # | Endpoint | Handler | Tests | Status |
|---|----------|---------|-------|--------|
| 289 | GET `/console/overview` | | | ⏳ |
| 290 | GET `/console/issues` | | | ⏳ |
| 291 | POST `/console/issues/{id}/actions/resolve` | | | ⏳ |
| 292 | POST `/console/issues/{id}/actions/reopen` | | | ⏳ |
| 293 | GET `/console/trace/{trace_or_issue_id}` | | | ⏳ |
| 294 | GET `/console/sessions` | | | ⏳ |
| 295 | DELETE `/console/sessions/{sid}` | | | ⏳ |
| 296 | GET `/console/jobs` | | | ⏳ |
| 297 | POST `/console/jobs/{id}/actions/retry` | | | ⏳ |
| 298 | POST `/console/jobs/{id}/actions/cancel` | | | ⏳ |
| 299 | GET `/console/integrations` | | | ⏳ |
| 300 | GET `/console/flags` | | | ⏳ |
| 301 | PUT `/console/flags/{key}` | | | ⏳ |
| 302 | GET `/console/tenants` | | | ⏳ |
| 303 | POST `/console/tenants/{id}/actions/suspend` | | | ⏳ |
| 304 | POST `/console/tenants/{id}/actions/restore` | | ⏳ |
| 305 | POST `/console/view-as` | | | ⏳ |

---

## Summary

**Total Endpoints:** 305 endpoints (expands to ~440 operations with actions)
- Platform: 76 endpoints
- Business: 175 endpoints
- CA Practice: 45 endpoints
- Console: 9 endpoints

**Current Status:** Phase 0 - Planning documents created
**Next Phase:** Phase 1 - Monorepo structure setup

# 05 · Data model

Postgres 16 uses four schemas: `core`, `biz`, `ca` and `dhani`.

**Every tenant table has these columns:**
- `id uuid pk` (UUIDv7)
- `tenant_id uuid not null`
- `created_at`, `created_by`, `updated_at`, `updated_by`
- `version int not null default 1`, used for `If-Match`
- `archived_at` where archiving applies

RLS is on and forced on every tenant table (see 02 §2). Soft delete exists only where stated; financial rows are **never** updated or deleted after posting.

## Units and rounding
- **Money:** `bigint` paise. GST is computed per line, as `round_half_up(taxable_line × rate)`. For the split, CGST = floor(tax/2) and SGST = tax − CGST. The document round-off goes to the nearest rupee and is posted to a *Round-off* account. Port `calc()` from `constants.js`; a hypothesis test checks the tax parity.
- **Quantities:** yarn and zari are in `bigint` milligrams, business stock qty is `numeric(18,3)`, and length is `int` millimetres.
- **Rates:** `numeric(12,4)` for rates and percentages.
- **Dates:** `date` for business dates, `timestamptz` for events. The fiscal year comes from `tenant.fy_start_month`.

## core
| Table | Key columns and constraints |
|---|---|
| users | firebase_uid unique, email citext unique null, phone_enc, phone_bidx unique null, name, lang, ui jsonb, sup bool, mfa_secret_enc, status |
| sessions | user_id, family_id, refresh_hash unique, device, ip, city, ua, created_at, last_seen_at, expires_at, revoked_at, ver |
| otp_codes | identifier_hash, purpose, code_hmac, attempts, expires_at, consumed_at |
| recovery_codes | user_id, code_hash, used_at |
| tenants | kind (business\|practice\|dhani), name, legal jsonb, gstin, state_code, fy_start_month, lang, settings jsonb, status, deleted_at |
| memberships | tenant_id, user_id, role_id, kind (member\|ca), org_unit_ids uuid[], status; unique(tenant_id, user_id) |
| invites | tenant_id, token_hash unique, email/phone, role_id, kind, invited_by, expires_at, status |
| roles | tenant_id, name, system bool, locked bool, limits jsonb, perm_version int |
| role_permissions | role_id, module, action, allowed bool; pk(role_id, module, action) |
| feature_switches | tenant_id, key, enabled; pk(tenant_id, key) |
| platform_flags | key pk, enabled, tenant_ids uuid[] |
| files | tenant_id, purpose, key, name, mime, size, sha256, status (pending\|clean\|infected), linked_type, linked_id |
| notifications | tenant_id, user_id, type, title, body, link, read_at; idx(user_id, read_at, created_at desc) |
| notification_prefs, devices | per user × event × channel; FCM tokens |
| messages | tenant_id, channel, to_enc, template, lang, entity_type, entity_id, status, provider_id, error |
| audit_log | **partitioned by month**: tenant_id, actor_id, act_as, action, entity_type, entity_id, diff jsonb, ip, ua, request_id, prev_hash, hash |
| outbox | tenant_id, type, payload jsonb, created_at, published_at, attempts, last_error; idx(published_at) where null |
| change_log | **partitioned**: tenant_id, seq bigint (per-tenant sequence), entity, entity_id, op, version, data jsonb |
| idempotency_keys | tenant_id, user_id, key, request_hash, status_code, response jsonb, expires_at; pk(tenant_id, user_id, key) |
| undo_tokens | token_hash pk, tenant_id, user_id, use_case, payload jsonb, expires_at, used_at |
| jobs | tenant_id, kind, status, progress, params, result_file_id, error, started_at, finished_at |
| number_series | tenant_id, series_key, fy, prefix, next int; unique(tenant_id, series_key, fy) |
| integration_secrets | tenant_id, key, secret_enc, meta jsonb |
| webhook_events | provider, event_id unique, received_at |
| console_issues | sev, title, module, tenant_id null, occurrences, first_at, last_at, status, trace_ids text[] |
| consents | user_id, purpose, granted_at, withdrawn_at |

## biz
| Table | Notes |
|---|---|
| accounts | code unique per tenant, name, type (asset\|liability\|equity\|income\|expense), group, parent_id, is_bank, is_system, bank_meta_enc, archived_at |
| periods | fy, month, status (open\|closed\|locked), closed_by, closed_at, locked_by |
| close_checklist | period_id, key, title, module, owner_id, done, done_at |
| journals | source_type, source_id, date, narration, posted_at, reversed_by. **The trigger enforces Σdr = Σcr** |
| gl_entries | **partitioned**: journal_id, account_id, dr_paise, cr_paise, party_id, org_unit_id, project_id, entity_id, date; idx(tenant_id, account_id, date) |
| gl_balances | account_id, period_id, org_unit_id, dr, cr; pk(tenant, account, period, org_unit) |
| parties | kind (customer\|supplier\|both), name, gstin, pan_enc, state_code, email, phone, terms_days, category_id, group_name, credit_limit, addresses jsonb (billing and ship-to), opening_balance; trigram idx on name |
| party_balances | party_id, receivable, payable, overdue, oldest_due (projection) |
| party_categories | kind, name, icon |
| items | type (goods\|service), sku, name, unit, hsn, gst_rate, sale_rate, purchase_rate, reorder_level, track_stock |
| locations | name, address |
| stock_moves | item_id, location_id, qty, cost_paise, source_type, source_id, date |
| stock_levels | item_id, location_id, on_hand, avg_cost (projection, locked per update) |
| documents | type, number, status, party_id, entity_id, date, due_date, terms_days, reference, salesperson_id, project_id, org_unit_id, tax_mode, place_of_supply, totals jsonb (sub, disc, taxable, cgst, sgst, igst, ro, total, tds, net), paid_paise, balance_paise, options jsonb, notes, narration, recurring jsonb, source_doc_id. unique(tenant_id, type, number); idx(tenant_id, type, status, date desc) |
| document_lines | document_id, position, item_id, account_id, description, hsn, qty, rate_paise, discount_pct, gst_rate, amount_paise, dr_paise, cr_paise (journals) |
| document_links | from_id, to_id, kind (converted\|applied\|received\|billed), amount_paise |
| payments | direction, party_id, date, mode, account_id, amount_paise, reference, status |
| payment_allocations | payment_id, document_id, amount_paise, tds_paise |
| payment_runs, payment_run_items | status, approver, bank_file_id |
| bank_connections | account_id, provider, status, consent_expires_at |
| bank_lines | account_id, date, description, amount_paise, balance_paise, ext_id unique per account, status, matched jsonb, rule_id |
| bank_rules | match jsonb, action jsonb, priority |
| assets | category, acquired_on, cost, rate_pct, method, accumulated, status, disposed_on |
| projects, budgets (account × org_unit × month), forecast_items, deals (+ recognition schedule), leases | as in the UI |
| tax_returns | type, period, status, working jsonb, arn, filed_at |
| gstr2b_lines, gstr2b_mismatches | supplier_gstin, invoice_no, amount, itc, kind, resolution |
| gst_entities | gstin, state_code, name, primary, registration |
| inbox_items | source, from, subject, file_id, parsed jsonb, confidence, kind, status, created_doc_id |
| approvals | source_type, source_id, amount_paise, reason, requested_by, approver_id, status |
| approval_rules | doc_type, min_amount, discount_pct, approver_role |
| queries | tenant_id (client), practice_tenant_id, thread messages[] (normalised into query_messages), status, module, entity ref |
| doc_requests (+ items) | practice_tenant_id, items, channel, due, reminders |
| imports, import_rows | entity, file_id, mapping jsonb, status, errors, committed_ids |
| org_units | parent_id, type (group\|company\|branch\|department\|cost_centre), name, head_id, code, active |
| watch_alerts | rule_key, severity, payload, status, snoozed_until |

## ca (practice tenant)
| Table | Notes |
|---|---|
| clients | name, type, industry, gstin, pan_enc, staff_id, fee_paise, client_tenant_id null, health, books_status |
| compliance_items | client_id, return_type, group (gst\|itr\|roc), period, due_date, status (Not started → Data pending → In progress → Ready for review → Filed), assignee_id, arn; unique(client, return_type, period) |
| compliance_rules | return_type, applies_to jsonb, due_day, frequency |
| tasks (+ task_checklist) | client_id, title, assignee, due, priority, column, position (fractional index) |
| review_items | client_id, rule_key, entity ref, issue, suggested_fix jsonb, amount, status |
| team_members | user_id, title, capacity_h, rate_paise |
| time_entries | client_id, staff_id, date, hours numeric(5,2), rate_paise, billable, billed_invoice_id |

## dhani
| Table | Notes |
|---|---|
| masters | kind, key, name, name_alt, data jsonb (hex, svg path, shades, hooks, unit), system bool, hidden; unique(tenant, kind, key) |
| rate_versions | effective_from, silk_paise_per_kg, zari_paise_per_marc, dye_paise, kooli_presets jsonb, defect_cut_paise, margin_pct jsonb {A,B,C}, round_to_paise |
| designs | code, name, type, body, border, pallu, border_style, motif, density, pallu_style, zari, border_width, hooks, motif_file_id, photo_file_id, thumbnail_file_id, source_design_id |
| setups | code, name, loom_type, status, material_per_saree jsonb {warp_mg, weft_mg, zari_mg}, colour_mode, slip_file_id, fields jsonb |
| setup_designs | setup_id, design_id, position |
| setup_sarees | setup_id, position, body, border, pallu, design_id, note, photo_file_id |
| weavers | name, name_alt, village_id, phone_enc, phone_bidx, loom_type, hooks, days_per_saree, hold_since, archived_at |
| weaver_stats | **projection**, pk weaver_id: done, total, pending, loom_piece_id, next_eta, late_days, earned, paid, advance, recover, cut, kooli_due, advance_out, net, yarn_held jsonb, status, last_activity_at. Indexed on (tenant, status, next_eta), (tenant, village_id) and (tenant, net) |
| assignments | setup_id, weaver_id, days_per_saree, start_date, wage_paise, advance_paise, status |
| pieces | assignment_id, weaver_id, setup_saree_id, seq, state (queue\|loom\|done\|moved\|cancelled), eta date, wage_paise, material jsonb, received_at, tag; idx(tenant, weaver_id, state, seq) |
| yarn_moves | **partitioned**: weaver_id null (null = store), material, dir (purchase\|give\|return\|consume\|adjust), qty_mg, rate_paise, source_type, source_id, date, note |
| material_stock | material, on_hand_mg, with_weavers_mg, avg_rate_paise (projection) |
| weaver_money | **partitioned**: weaver_id, kind (earned\|paid\|advance\|recover\|cut\|adjust), amount_paise (> 0), source_type, source_id, reversal_of, date, note |
| receipts | piece_id unique, weaver_id, colours_match, alt_colours jsonb, defects text[], grade, length_mm, deduction_paise, cut_advance_paise, paid_now_paise, mode, photo_file_ids, reversed_at |
| godown_items | tag unique per tenant, receipt_id, design_id, body, border, pallu, weaver_id, setup_id, piece_seq, grade, defects, length_mm, cost jsonb (silk, zari, dye, kooli, total), list_price_paise, status (stock\|reserved\|sold\|returned), reserved_for, reserved_until, sale_id, location; idx(tenant, status, body), trigram on tag |
| parties | role, name, name_alt, phone_enc, phone_bidx, city, gstin, opening_balance |
| party_balances | projection |
| sales | bill_no unique, party_id null, walk_in_name, date, subtotal, discount, total, paid, due, due_date, status, voided_at |
| sale_lines | sale_id, tag, price_paise |
| sale_payments | sale_id, mode, amount_paise, date, reversal_of |
| ledger | **partitioned**: date, dir (in\|out), amount_paise, party_id, who, role, category, mode (cash\|upi\|bank), what, source_type, source_id, reversal_of, file_id; idx(tenant, date desc), (tenant, dir, category) |
| cash_counts | mode, counted, expected, diff, by |
| demand | colour_key, design_id, party_id, note, date |
| catalogues | token_hash, selection jsonb, show_price, expires_at, views |

## Invariants (DB constraint or service guard + test)
1. Posted business documents are immutable apart from payment and link columns.
2. Σdr = Σcr for every journal (trigger).
3. There is no GL row dated in a locked period (trigger raises `period.locked`).
4. `stock_levels.on_hand` ≥ 0 unless `allow_negative`, and `dhani.material_stock.on_hand_mg` ≥ 0.
5. A godown tag is sold at most once. `sale_lines.tag` is unique where the sale isn't voided (a partial unique index).
6. A piece is received at most once (`receipts.piece_id` unique, filtered to rows that aren't reversed).
7. Each weaver has exactly one `pieces.state='loom'` row at a time, unless on hold (a partial unique index on `weaver_id` where the state is `loom`).
8. `weaver_money` and `ledger` amounts are > 0. The direction comes from the kind or `dir`. Corrections are rows with `reversal_of`.
9. Projections equal a recompute from the source tables. A nightly `verify_projections` job opens a console issue on any drift.
10. Number series have no gaps: they are allocated inside the transaction, and a voided document keeps its number.

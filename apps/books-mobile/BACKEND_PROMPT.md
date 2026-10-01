# Byjan Books — Backend implementation prompt (Cursor / Devin)

Paste this whole file into Cursor or Devin, with the `expense-tracker` repo open. The new mobile app lives in `byjan-books-mobile/`. It calls the same `api/` on Vercel and Neon Postgres. Your job is to make every call in this document work end to end. Every action and every flow must work, including the small ones. Don't stop until every box in **§12 Acceptance** is ticked.

---

## 0. Ground rules

- **Stack stays the same.** Vercel serverless functions under `api/`, Neon Postgres via `api/_lib/db.ts`, and Firebase ID tokens in `Authorization: Bearer`. Domains route through `api/tracker.ts?domain=…` (see `vercel.json` rewrites).
- **Request shape.** Every request is `POST` with JSON `{ op, ...args }`. Every response is JSON.
- **Errors.** Errors are `{ error: "<friendly sentence>", code: "<MACHINE_CODE>" }` with the right HTTP status:
  - 400 validation
  - 401 no or invalid token
  - 402 quota or plan
  - 403 role or feature
  - 404 not found
  - 409 duplicate
  - 429 rate limit
  - 5xx unexpected

  Never leak SQL, stack traces or provider names in `error`.
- **Money.** All money is **integer paise** in the DB. The API may also return rupees where the existing contract already does (`expense.amount`).
- **Idempotency.** Every write that the app retries carries `idempotencyKey`. Store it with a unique index and return the original result on replay.
- **Ownership.** The server resolves the caller from the token. Never trust a `uid` sent in the body except on `/api/owner` ops, and those are super-user only.
- **Super user.** A super user is `emailIsSuperUser(email)` from `api/_lib/super-users.ts` (env `SUPER_USER_EMAILS` + built-ins). The app calls this person the **Owner**. Check it on **every** `/api/owner` op, not only in the UI.
- **Audit.** Every owner write takes a mandatory `reason` (≥ 4 chars). Write it to `owner_audit`. Reject with 400 `REASON_REQUIRED` if it is missing.
- **Tests.** Add tests next to the existing `scripts/*-test.ts`, run them with `npm run test:all`, and keep them green.

## 1. Routing changes (`vercel.json`)

Add these rewrites. Keep the existing ones.

```json
{ "source": "/api/saas",   "destination": "/api/tracker?domain=saas" },
{ "source": "/api/owner",  "destination": "/api/tracker?domain=owner" },
{ "source": "/api/invites","destination": "/api/invites" },
{ "source": "/api/payments/cashfree/webhook", "destination": "/api/payments/cashfree-webhook" },
{ "source": "/pay/cashfree", "destination": "/api/payments/cashfree-page" }
```

Then:

- Add `api/payments/cashfree-webhook.ts` and `api/payments/cashfree-page.ts` to `functions` with `maxDuration: 30` and `includeFiles: "api/{_pg-tables.js,_lib/**}"`.
- Add a cron to `vercel.json`: `"crons": [{ "path": "/api/tracker?domain=saas&op=cron", "schedule": "0 * * * *" }]`. It runs hourly. Protect it with `CRON_SECRET` (the Vercel cron header).

## 2. Environment

```
CASHFREE_APP_ID=...            # from Cashfree dashboard
CASHFREE_SECRET_KEY=...
CASHFREE_ENV=sandbox|production
CASHFREE_WEBHOOK_SECRET=...    # same as secret key for PG v2023-08-01 signature
PUBLIC_APP_URL=https://www.easypado.com
CRON_SECRET=...
SUPER_USER_EMAILS=pujaribadrinath@gmail.com,byjanbooks@gmail.com
```

Use Cashfree base URLs:

- `https://sandbox.cashfree.com/pg` (sandbox)
- `https://api.cashfree.com/pg` (production)

Send these headers: `x-client-id`, `x-client-secret`, `x-api-version: 2023-08-01`.

## 3. Database (add to `api/_lib/pg-tables.ts` and `api/migrate.ts`, idempotent `CREATE TABLE IF NOT EXISTS`)

```sql
plans(id text pk, name text, tagline text, badge text, sort int, visible bool, archived bool default false,
      price_monthly_paise int, price_annual_paise int, per_seat bool, included_seats int, max_seats int,
      seat_price_monthly_paise int, seat_price_annual_paise int, trial_days int,
      limits jsonb,            -- { receipt_scans, voice_entries, smart_search, email_captures, ai_insights, books, members_per_book, storage_mb } ; -1 = unlimited
      features jsonb,          -- FeatureMap (keys from src/lib/features.ts); default all true
      highlights jsonb, updated_at timestamptz, updated_by text)
addons(id text pk, name text, meter text, quantity int, price_paise int, recurring bool, visible bool, updated_at timestamptz)
offers(id text pk, code text unique, title text, description text, kind text check (kind in ('percent','flat','extra_days','extra_quota')),
       value numeric, meter text, plan_ids jsonb, cycles jsonb, starts_at date, ends_at date, max_redemptions int, per_user_limit int,
       first_payment_only bool, auto_apply bool, active bool, redemptions int default 0, updated_at timestamptz)
offer_redemptions(id text pk, offer_id text, uid text, order_id text, at timestamptz, unique(offer_id, order_id))
subscriptions(uid text pk, plan_id text, status text check (status in ('free','trialing','active','past_due','cancelled','expired')),
              cycle text, seats int, addons jsonb, current_period_start timestamptz, current_period_end timestamptz,
              trial_ends_at timestamptz, cancel_at_period_end bool default false, comp_until date, comp bool default false,
              billing jsonb, next_amount_paise int, updated_at timestamptz)
usage_counters(uid text, period text, meter text, used int default 0, extra int default 0, primary key(uid, period, meter))
orders(id text pk, uid text, kind text, plan_id text, cycle text, seats int, addons jsonb, coupon text, quote jsonb, billing jsonb,
       cf_order_id text, payment_session_id text, status text, idempotency_key text unique, created_at timestamptz, paid_at timestamptz)
payments(id text pk, order_id text, uid text, cf_payment_id text unique, amount_paise int, status text, method text,
         failure_reason text, refunded_paise int default 0, raw jsonb, created_at timestamptz)
invoices(id text pk, number text unique, uid text, order_id text, date date, lines jsonb, subtotal_paise int, discount_paise int,
         tax_paise int, cgst_paise int, sgst_paise int, igst_paise int, total_paise int, status text, seller jsonb, buyer jsonb,
         pdf_path text, credit_note_of text)
owner_audit(id text pk, at timestamptz, actor_uid text, actor_email text, action text, target text, detail jsonb, reason text)
app_config(id int pk default 1, config jsonb, updated_at timestamptz)
inbox_items(id text pk, uid text, book_id text, kind text, preview jsonb, at timestamptz, dismissed_at timestamptz)
devices(token text pk, uid text, platform text, updated_at timestamptz)
capture_corrections(id text pk, uid text, book_id text, capture_id text, before jsonb, after jsonb, at timestamptz)
user_status(uid text pk, status text, reason text, at timestamptz)  -- or a column on users
```

Add indexes on `orders(uid)`, `payments(uid, created_at)`, `invoices(uid, date)`, `usage_counters(period, meter)`, `owner_audit(at desc)` and `inbox_items(uid, dismissed_at)`.

**Seed (first migrate only; the owner can change everything later):**

| id | name | ₹/mo | ₹/yr | seats | scans | voice | search | email | insights | books | members/book | storage MB | trial |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| free | Free | 0 | 0 | 1 | 30 | 20 | 20 | 30 | 3 | 5 | 3 | 500 | 0 |
| plus | Plus | 99 | 999 | 1 | 300 | 200 | 200 | 300 | 20 | 20 | 8 | 3000 | 14 |
| pro | Pro (badge "Most popular") | 249 | 2,499 | 1 | 1500 | -1 | -1 | 1500 | 100 | -1 | 20 | 15000 | 14 |
| business | Business (per seat, 3 included, max 100) | 599 | 5,990 | +149/seat/mo, +1,490/seat/yr | 5000 pooled | -1 | -1 | 5000 | -1 | -1 | 100 | 100000 | 14 |

All plans start with `features = allOn()`. That is the brief: every feature on every plan, with only the limits differing.

Seed these add-ons:

- `scans100`: +100 receipt_scans, ₹49, one-time
- `storage5g`: +5000 storage_mb, ₹79/mo, recurring
- `members5`: +5 members_per_book, ₹99/mo, recurring

Seed `app_config`:

```
{ maintenance:false, maintenanceMessage:'', announcement:'', announcementTone:'info', minAppVersion:'2.0.0',
  defaultPlanId:'free', trialPlanId:'pro', trialDays:14, gstRate:18, sellerName:'Byjan', sellerGstin:'', sellerState:'Karnataka',
  invoicePrefix:'BYJ', supportEmail:'byjanbooks@gmail.com', graceDays:7, usageResetDay:1 }
```

## 4. Entitlements — one function used everywhere

Create `api/_lib/entitlements.ts`:

- `getSubscription(uid)`
  - Creates a row on first call: `defaultPlanId`, status `free`.
  - If `trialPlanId` and `trialDays > 0` are set and the user is new (created < 5 min ago), start the trial: `trialing` with `trial_ends_at`.
- `periodKey(uid)`: `YYYY-MM` based on `usageResetDay`.
- `effectiveLimits(uid)`: `plan.limits` + recurring add-ons + `usage_counters.extra` for this period.
  - `comp` / `trialing` / `active` / `past_due` (within grace) use the subscription's plan.
  - Everything else uses `defaultPlanId`.
- `effectiveFeatures(uid)` = `isSuperUser ? allOn : (person override in users.feature_override ?? (plan.features ∧ role permissions))`.
  - Keep the existing `resolveFeatures` semantics from `src/lib/features.ts`: parents gate children.
  - `/api/me get` must now return these as `user.features`.
- `consume(uid, meter, n=1)`: atomic `INSERT … ON CONFLICT DO UPDATE SET used = used + n WHERE used + n <= limit + extra RETURNING used`.
  - If no row is returned, throw 402 `{ code:'QUOTA_EXCEEDED', meter, used, limit, resetsAt, error:'You’ve used this month’s <label>. Upgrade or add a top-up to keep going.' }`.
  - Super users are never limited.
  - `-1` means unlimited, but still count usage for reports.
- `refund(uid, meter, n=1)`: give the count back when the action failed after consuming.
- `checkCount(uid, meter, current)`: for non-monthly meters (books, members_per_book, storage_mb). Compare the live count, and throw 402 if creating one more would exceed the limit.

**Where to call it (no exceptions):**

| Op | Meter | When |
|---|---|---|
| `money.processReceipt` with image/PDF/text from share, camera, gallery, file | receipt_scans | before the model/vision call; `refund` if parsing throws |
| `money.parseCapture` source `voice` | voice_entries | before parse |
| `money.parseCapture` source `sms`/`share` | receipt_scans | before parse |
| `money.nlSearch` | smart_search | before search |
| `money.insights` (new) | ai_insights | before model call |
| `email/inbound.ts` per created entry | email_captures | before creating; if over → put in `inbox_items` kind `review` with note "Limit reached", don't drop the mail |
| `ledgers.create` | books | count non-deleted books owned by caller |
| `invites.create` / `invites.accept` | members_per_book | count members on the book; the **book owner's** plan decides |
| `blob/upload` | storage_mb | sum of the caller's stored bytes |
| feature gate | — | each op above also returns 403 `FEATURE_OFF` if `effectiveFeatures` has the matching key off (`money_scan`, `money_voice`, `money_search`, `money_email_mailbox`, `money_ai_insights`, `money_create_book`, `money_people`, `money_export`, `money_split_*`, `money_settle`, `money_delete`, `money_delete_book`, `money_add`) |

## 5. Receipt → entry auto-fill (the app's key flow)

The app uploads with `/api/blob/upload` (unchanged headers), then calls:

```
POST /api/money { op:'processReceipt', bookId, receiptPath, receiptName, text?, source, idempotencyKey, imageBase64?, imageMime?, mimeType?, autoConfirm:false }
```

`source` is one of `share | phonepe | gpay | paytm | sms | email | whatsapp | camera | gallery | file | attach | voice | link`.

Return `{ preview, previews?, flowState, copy, autoSelectBookId?, usage:{feature,used,limit} }`.

**`preview` must fill every field of the entry form.** Leave a field as an empty string or omit it only when it really isn't in the document:

```
id, source, direction ('MONEY_OUT'|'MONEY_IN'|'TRANSFER'), txType ('EXPENSE'|'INCOME'|'TRANSFER'|'REFUND'|'REVERSAL'|'CREDIT_CARD_PAYMENT'|'CASH_WITHDRAWAL'|'CASH_DEPOSIT'),
amountPaise, currency, date (YYYY-MM-DD), time (HH:mm 24h), merchant (payee / payer), description (what for — UPI note, "Paid for", item summary),
category (closest of the book's categories, else CATEGORY_RULES), paymentMethod ('upi'|'card'|'cash'|'bank'|'wallet'),
accountId (the book's moneyAccounts id whose kind matches paymentMethod), fundSource (e.g. "HDFC ••4421 via PhonePe"),
upiRef (12-digit UPI ref / UTR / transaction id), vpa (payee UPI ID), invoiceNumber, taxAmount (rupees, total GST), documentType ('receipt'|'bill'|'invoice'),
items [{name, qty, amount}], notes (anything else useful: GSTIN of seller, address, card last 4), adjustments,
receiptPath, receiptName, confidence ('high'|'medium'|'low'), fieldConfidence { <field>: 0..1 }, reasons [string], duplicateOf (expense id or omitted),
processingStatus, financialStatus
```

Implementation:

1. **Text first.** Gather text from three sources:
   - `text` (SMS or shared text)
   - PDF text via `api/_lib/pdf-text.ts`
   - Office files via `office-text.ts`

   Run the existing deterministic mappers on it: `receipt-fields.ts` `parseReceiptFields` + `amount-parse.ts` + `settlement-upi.ts`.
2. **Vision.** Use `receipt-vision.ts` (Gemini) for images, and for PDFs with no text layer. Prompt it to return **exactly** the JSON keys above, with Indian formats (₹, DD/MM/YYYY, 12-hour times, UPI apps: PhonePe, Google Pay, Paytm, BHIM, Amazon Pay, CRED; bank SMS formats: "debited by", "credited with", "A/c XX1234", "UPI Ref No", "UTR").
3. **Merge.** Vision wins for amount/date/merchant on images. Text wins on SMS. Then set:
   - `fieldConfidence[k] = 0.95` where both sources agree
   - `0.75` where only one found it
   - `0.5` for guessed values (category from rules, account from method)
4. **Normalise.**
   - `category`: map to the **book's** categories with case-insensitive / contains matching. Learn from `capture_corrections`: if this user corrected merchant X → category Y before, use Y with 0.9 confidence.
   - `accountId`: from `paymentMethod` → book `moneyAccounts.kind`.
   - `direction`: from "credited / received / refund / cashback".
   - `time`: from the receipt; omit it if missing (the app keeps the current time).
5. **Duplicate check.** Use the same amount ±0, date ±1 day, and the same `upiRef` when present → `duplicateOf`. Reuse `duplicate-match.ts`.
6. **Persist.** Save to `inbox_items` (kind `review` if confidence low or duplicate, else nothing). Return the preview. Do **not** create the expense unless `autoConfirm` is true; the app shows the filled form first.
7. **Multi-receipt.** PDFs or screenshots with several payments return `previews[]`.

`POST /api/money { op:'learnCorrection', bookId, captureId, before, after }` stores rows in `capture_corrections`. Use them in step 4.

Then `POST /api/expenses { op:'create', bookId, expense, idempotencyKey, force }` saves the reviewed entry. It must persist **all** these fields:

```
amount, currency, date, time, entryType, txType, merchant, description, category, paymentMethod, accountId, toAccountId, fundSource,
upiRef, vpa, invoiceNumber, taxAmount, documentType, notes, adjustments, paidByUid, receiptPath, receiptName, flagged, source, captureId
```

It also links `captureId` → marks the inbox item done, writes the audit/timeline event, and sends push + email to other book members (respect each member's `appPrefs.pushOn` / `emailOn`).

- Return 409 `{ code:'DUPLICATE', matches }` when `force` is false and a duplicate exists.
- `checkDuplicate` keeps working as today.

**Share-sheet contract** (Android native → JS, already in the app): `ShareReceiver.checkPending()` returns `{ text, mimeType, fileName, dataBase64, files[], source, receivedAt }`. Nothing to do server-side beyond the above.

**Email-in** (`api/email/inbound.ts`):

- Create the entry with the same preview pipeline.
- Over quota or low confidence → `inbox_items` instead.

## 6. Other ops the app now calls

| Endpoint | op | Contract |
|---|---|---|
| /api/me | get | `{ user:{ uid,email,displayName,photoURL,upiId,upiDisplayName,defaultCurrency,appPrefs,features,isSuperUser,status } }` (features = effectiveFeatures) |
| /api/me | upsert | merges `patch` (never `features`/`isSuperUser`) |
| /api/me | deleteAccount | `{reason}` → cancel subscription at period end, mark user `deleted`, schedule data purge in 30 days, revoke Firebase tokens |
| /api/money | listInbox | `{ items:[{id,bookId,bookName,preview,kind:'review'|'duplicate'|'upcoming'|'failed',at}] }` for books the caller can see |
| /api/money | dismissInbox | `{id}` |
| /api/money | insights | `{bookIds,from,to}` → `{ insights:[string] }` (3–5 plain sentences; consumes ai_insights) |
| /api/money | reportSummary | must include `byMonth`, `byCategory`, `byMethod`, `topMerchants` |
| /api/money | listTimeline | `{events:[{id,at,actor,action,detail}]}` |
| /api/money | saveSplit | accepts `{method:'equal'|'exact'|'percent'|'shares', paidByUid, parts:[{uid,name,sharePaise}]}`; reject if Σ sharePaise ≠ amount; create/replace settlements |
| /api/money | existing UPI/settlement ops | unchanged (`listSettlements`, `listMySettlements`, `listMemberUpi`, `requestMemberUpi`, `saveMyUpi`, `startUpiPayment`, `reportUpiReturn`, `confirmSettlementReceived`, `markSettlementReview`) |
| /api/ledgers | list/get/create/update/softDelete/forgetBook/removeMember/ensureMailbox/auditList/mailList | unchanged; `update` must accept `pinned`, `monthlyBudget`, `categories`, `moneyAccounts`, `roles` (role change only by owner/admin; never demote the owner) |
| /api/invites | create | `{bookId, role, email?}` → `{ link, code, expiresAt }` (7 days, single use; email the link if `email`) |
| /api/invites | accept | `{code}` → `{ bookId }`; 410 `INVITE_EXPIRED`, 409 `ALREADY_MEMBER`, 402 members limit |
| /api/notifications | list / markRead / registerDevice | `{notifications:[{id,title,body,at,read,bookId,expenseId,kind}]}`; `registerDevice {token, platform}` upserts `devices` |
| /api/email/send-report | — | `{bookId, month, to}` → PDF report email (existing) |

## 7. `/api/saas` (customer)

| op | Input | Output / behaviour |
|---|---|---|
| publicConfig | — (no auth) | `{config:{maintenance,maintenanceMessage,announcement,announcementTone,minAppVersion}}` |
| catalog | — | `{plans (visible, not archived, sorted), addons (visible), offers (active, autoApply, in date), gstRate, currency:'INR'}` |
| me | — | `{subscription, plan, usage:{periodStart,periodEnd,meters:{<meter>:{used,limit,extra}}}, offers}` |
| quote | `{kind:'plan'|'addon'|'renewal', planId, cycle, seats, addons, coupon, billing}` | `{quote:{lines,subtotalPaise,discountPaise,taxPaise,totalPaise,offer,couponError?,prorationNote?}}` — see pricing rules |
| validateCoupon | `{code, planId, cycle}` | `{offer}` or `{error}` |
| createOrder | same as quote + `billing{name,email,gstin?,state?,address?}` | creates `orders` row, calls Cashfree `POST /orders` with `order_amount = totalPaise/100`, `order_currency:'INR'`, `customer_details{customer_id:uid, customer_email, customer_phone (required: use profile phone or '9999999999' placeholder)}`, `order_meta{return_url: PUBLIC_APP_URL + '/pay/return?order_id={order_id}', notify_url: PUBLIC_APP_URL + '/api/payments/cashfree/webhook'}`, `order_tags{uid, kind}` → `{orderId, paymentSessionId, mode, quote}`. If total is 0 (100% coupon / extra_days), activate immediately and return `{orderId, free:true}` |
| verifyOrder | `{orderId}` | `GET /orders/{id}` + `/orders/{id}/payments`; if PAID → `activate()` (idempotent) → `{status:'PAID', subscription, invoice}`; else `PENDING`/`FAILED`/`EXPIRED`/`USER_DROPPED` with a friendly `message` |
| startTrial | `{planId}` | only if never trialed and plan.trialDays > 0 → `trialing` |
| cancel | `{atPeriodEnd:true, reason}` | `cancel_at_period_end = true` (store reason) |
| resume | — | clear `cancel_at_period_end` |
| changeSeats | `{seats}` | increase → prorated order (returns `orderId`, `paymentSessionId`, `quote`); decrease → schedule for renewal (returns `subscription`) |
| listInvoices | — | newest first |
| invoicePdf | `{id}` | `{url}` short-lived signed URL (generate PDF with jsPDF on first request, store via blob-store) |
| updateBilling | `{billing}` | validate GSTIN regex `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$` |
| cron | (Vercel cron, `CRON_SECRET`) | hourly jobs in §9 |

**Pricing rules (`api/_lib/pricing.ts`, unit-tested):**

1. Base price is the plan price for the cycle. For per-seat plans, add `max(0, seats - includedSeats) × seat price`.
2. Add-ons add their price.
3. **Plan change during a period:** credit the unused part of the current period, `(remaining days / period days) × last paid subtotal`. Apply the credit as a negative line "Credit for unused <old plan>". Set `prorationNote`.
4. **Offer:** validate, then apply.
   - Validation checks: active, date window, plan in `plan_ids` (or empty), cycle in `cycles`, `redemptions < max_redemptions` (0 = no cap), per-user count `< per_user_limit`, `first_payment_only` → the user has no paid order.
   - Auto-apply offers apply without a code. Take the best single offer; offers don't stack.
   - `percent` → `round(subtotal × value / 100)`; `flat` → `min(value, subtotal)`; `extra_days` → extends the period, no price change; `extra_quota` → adds `extra` to the meter on activation.
5. **GST:** `gstRate`% on `(subtotal - discount)`. Same state as the seller → CGST + SGST halves; otherwise IGST. Unknown buyer state → IGST.
6. Round to the paise at each line. Total = subtotal − discount + tax.

**`activate(order)` (idempotent on `order.id`):**

- Set the subscription: plan, cycle, seats, status `active`, and the period.
  - New: now → +1 month / +1 year.
  - Renewal: extend from the current end.
  - Upgrade: restart from now.
- Clear `cancel_at_period_end` and `trial_ends_at`. Add `extra_days` if any.
- Apply `extra_quota`, and apply add-on quantities to `usage_counters.extra` for this period.
- Increment the offer redemption.
- Create the invoice. The number is `${invoicePrefix}/${FY}/${seq}`; FY is April–March, e.g. `BYJ/26-27/000123`.
- Email the invoice PDF. Push "You're on <plan>".

## 8. Cashfree webhook + hosted page

- `api/payments/cashfree-webhook.ts`
  - Verify `x-webhook-signature` = base64(HMAC-SHA256(`x-webhook-timestamp` + rawBody, CASHFREE_SECRET_KEY)). Reject with 401 if it doesn't match. Use the **raw** body.
  - Handle `PAYMENT_SUCCESS_WEBHOOK` → upsert `payments` then `activate(order)`.
  - Handle `PAYMENT_FAILED_WEBHOOK` / `PAYMENT_USER_DROPPED_WEBHOOK` → store the payment with `failure_reason`. If this was a renewal → `past_due`.
  - Handle `REFUND_STATUS_WEBHOOK` → update `refunded_paise`.
  - Always reply 200 quickly. Process idempotently by `cf_payment_id`.
- `api/payments/cashfree-page.ts` (GET `/pay/cashfree?session=&order=&mode=`) returns a tiny HTML page that loads `https://sdk.cashfree.com/js/v3/cashfree.js` and calls `Cashfree({mode}).checkout({paymentSessionId: session, redirectTarget: '_self'})`. Cashfree's `return_url` goes to `/pay/return?order_id=…`, which renders "Payment received — return to the app" and deep-links to `com.byjanbooks.app://payment?order_id=…`.
- **Refunds:** `POST /orders/{order_id}/refunds` with `refund_amount`, `refund_id`, `refund_note`. Create a credit note invoice (`credit_note_of`).
- **Sandbox test:** UPI `testsuccess@gocash` / `testfailure@gocash`; card 4111 1111 1111 1111. Test both paths.

## 9. Scheduled jobs (`saas.cron`, hourly, each idempotent)

1. **Trial ending:** reminders 3 days and 1 day before (`trial_ends_at`). At expiry → `free` (or `expired` if you want a "trial ended" banner) and push "Your trial ended".
2. **Renewal reminder:** 3 days before `current_period_end` for `active`, not cancelling → email + push with a "Pay now" link (the app opens checkout `kind:'renewal'`).
3. **Period end:**
   - `cancel_at_period_end` → `cancelled` then `free`.
   - Otherwise not renewed → `past_due`.
   - `past_due` beyond `graceDays` → `free` and notify.
4. **Comp end:** past `comp_until` → plan's normal billing, or `free`.
5. **Usage reset:** nothing to delete (the period key changes). Clear non-recurring `extra` at the new period.
6. **Purge** accounts deleted more than 30 days ago.

## 10. `/api/owner` (super user only — re-check on every op)

Every op returns 403 `NOT_OWNER` for anyone else. Every write needs `reason` and writes `owner_audit`.

| op | Input | Behaviour |
|---|---|---|
| overview | — | `{overview:{mrrPaise (monthly + annual/12, active only), arrPaise, revenueThisMonthPaise, users, payingUsers, trialing, pastDue, churnedThisMonth, signupsByDay[30], revenueByMonth[12], planMix, topMeters, failedPayments, nearLimitUsers (≥80% on any meter)}}` |
| listUsers | `{q, planId?, status? ('trialing'|'active'|'past_due'|'cancelled'|'suspended'|'override'), cursor}` | search email/name/uid (ILIKE), 50 per page, `{users, next, total}` with `planId, subStatus, cycle, seats, mrrPaise, books, entries, lastActiveAt, status, hasFeatureOverride` |
| getUser | `{uid}` | `{user (+features effective), subscription, usage, payments, bookList:[{id,name,role,entries}]}` |
| setUserFeatures | `{uid, features|null, reason}` | null → remove the override (follow plan); else store the normalised override. Must reflect in the user's next `/api/me get` |
| setUserPlan | `{uid, planId, cycle, seats, until?, comp, reason}` | comp → `comp=true, comp_until=until`, status `active`, no charge; else set the plan and charge at renewal |
| grantQuota | `{uid, meter, amount, reason}` | `usage_counters.extra += amount` for the current period |
| resetUsage | `{uid, meter, reason}` | `used = 0` for the current period |
| setUserStatus | `{uid, status:'active'|'suspended', reason}` | suspended → every API call from that uid returns 403 `SUSPENDED` "Your account is paused. Contact support." and their Firebase refresh tokens are revoked. Never allow suspending yourself or another super user |
| listPlans / savePlan / archivePlan | plan JSON | validate (name, non-negative prices, annual ≤ 12 × monthly, maxSeats ≥ includedSeats, limits ints ≥ −1, features normalised). Price changes apply to new orders and to each subscription at its next renewal; limits and features apply immediately |
| saveAddon | addon | validate meter key and price ≥ 0 |
| listOffers / saveOffer | offer | code `^[A-Z0-9_-]{3,20}$` unique; percent 1–100; end ≥ start |
| usageReport | `{month}` | per meter: used and distinct users; top 50 users by % of limit |
| listPayments | `{status:'ALL'|'SUCCESS'|'FAILED'|'REFUNDED', cursor}` | newest first, 50 per page |
| refund | `{paymentId, amountPaise, reason}` | ≤ refundable; Cashfree refund; credit note; audit |
| listAudit | `{cursor}` | newest first |
| getConfig / saveConfig | config | validate GSTIN, gstRate 0–28, usageResetDay 1–28; bust the publicConfig cache |
| sendAnnouncement | `{title, body, audience, push, reason}` | in-app notification row for each matching user; FCM push if `push` (`api/_lib/fcm.ts`) → `{sent}` |

Also enforce `app_config.maintenance`: every non-owner request returns 503 `MAINTENANCE` with `maintenanceMessage`.

## 11. Security checklist

- Verify the Firebase token on every route. Map `uid` from the token only.
- Book-level role checks:
  - owner/admin manage people
  - contributor adds/edits
  - viewer reads only
- Feature-level checks (§4) on the server, not only in the UI.
- Rate limit `processReceipt`, `nlSearch`, `insights` and `createOrder` (e.g. 30/min per uid). Rate limit `invites.accept` per IP.
- Webhook signature + raw body. Never trust client-reported payment success; only `verifyOrder` or the webhook may activate.
- Store no card or UPI data. Cashfree keys stay server-only.
- Blob read URLs stay signed and expire; only book members can read a receipt.
- Owner ops: super-user check + reason + audit, and no self-suspend.
- Deleting a user cancels billing and removes PII after 30 days.

## 12. Acceptance — every flow must pass (write a test or a scripted manual check for each)

**Auth**
- [ ] Email sign-up sends verification. The app blocks until verified. "I've verified" works. Resend has a 30s cooldown.
- [ ] Email sign-in shows friendly errors for wrong password, no account and too many attempts.
- [ ] Google sign-in works on a Play build (SHA-1/256 registered), and cancelling shows "cancelled".
- [ ] Forgot password sends a link. Sign-out clears caches. Delete account schedules a purge and cancels the plan.
- [ ] A new user gets the default plan, plus a trial if configured.

**Books & entries**
- [ ] Create a book (purpose categories, currency). At the books limit you get 402 and the paywall.
- [ ] Pin/unpin, rename, budget, categories and accounts (add/rename/archive) all save. Delete book (owner only). Leave book (non-owner).
- [ ] Add an entry with **every** field; reopening shows every field intact.
- [ ] Edit, duplicate (date reset, ref cleared), flag/unflag, delete with undo (re-create), filters (type/category/method/flagged/month) and search.
- [ ] Duplicate detection: same amount + date ± 1 + same UPI ref → 409 → "Save anyway" uses `force`.
- [ ] Transfer requires two different accounts.
- [ ] An offline entry is queued and syncs on reconnect, with no duplicates (idempotencyKey).
- [ ] CSV export opens the share sheet. Email PDF report arrives.

**Receipt auto-fill**
- [ ] Share a PhonePe, a Google Pay and a Paytm success screenshot → amount, date, time, payee, UPI ref, payee VPA, paid from (bank ••last4 + app), method UPI, account UPI and category all filled. Low-confidence fields are flagged.
- [ ] Share a bank debit SMS and a credit SMS (direction IN). Share a restaurant bill photo (items in notes, GST, bill no.). Share a PDF invoice (invoice number, GST, document type invoice) and an Excel/CSV file.
- [ ] Gallery: pick 5 screenshots at once → 5 forms in sequence ("1 of 5"), each fully filled.
- [ ] Camera scan, attach in form with "read", email forward to the book address, voice ("paid 450 for diesel by UPI").
- [ ] Correct a category once → the next receipt from the same merchant gets the corrected category.
- [ ] Over the scan limit → paywall; manual entry still works. A failed parse refunds the count.

**Splits & settle**
- [ ] Equal, exact (must sum exactly), percent (must total 100) and shares splits. Balances appear.
- [ ] Pay via PhonePe/GPay/Paytm/BHIM intent → back in app → "Did it go through?" → submitted → payee "Received" → settled. "Not received" → review with reason.
- [ ] "Ask UPI" when the payee has no UPI ID notifies them.

**People**
- [ ] Invite link (single use, 7 days) works via WhatsApp share. Email invite works.
- [ ] Accept with an expired code shows the friendly message. At the members limit → 402.
- [ ] Change role (admin/contributor/viewer). Remove member. A viewer can't add.

**SaaS (customer)**
- [ ] The Plans screen shows owner-edited prices, limits, highlights, badge and seat stepper, plus an auto-apply offer banner.
- [ ] Start a trial (once only).
- [ ] Checkout: coupon valid/invalid/expired/used-up, GSTIN validation, IGST vs CGST+SGST by state.
- [ ] Cashfree sandbox UPI success → activated, invoice emailed, limits updated in the app. Failure → "didn't go through" and nothing activated. Closing checkout → "cancelled".
- [ ] Webhook arrives before `verifyOrder` → still a single activation and a single invoice.
- [ ] Upgrade mid-period → proration credit line. Add seats → prorated charge. Remove seats → next renewal.
- [ ] Buy a top-up → extra applied this period.
- [ ] Cancel (with reason) → access to period end → free. Resume before the end.
- [ ] Renewal reminders. A failed renewal → past_due banner + "Pay now" → grace → free.
- [ ] Invoice list + PDF download. Edit GSTIN.

**Owner (super user only)**
- [ ] A non-super user calling any `/api/owner` op → 403 (test with a direct HTTP call, not just the UI).
- [ ] Overview numbers match the DB.
- [ ] Users: search by email/name/uid; filter by plan, status and custom access; paging.
- [ ] Access: turn off `money_scan` for one user → their app hides Scan and the server returns 403 FEATURE_OFF. Reset to plan defaults restores it.
- [ ] Plan features: turn off `money_voice` on Free → every Free user loses Voice. A per-user override can re-enable it.
- [ ] Plans: edit price/limits/trial/seat pricing; hide; archive (existing subscribers unaffected). Top-ups CRUD.
- [ ] Offers: percent/flat/extra days/extra quota; schedule next month; per-user and total caps; first payment only; auto-apply banner.
- [ ] Change a user's plan / give free months (comp until a date) → no charge, reverts after the date.
- [ ] Grant extra quota and reset a meter. Suspend (signed out, 403 everywhere) and restore. Self-suspend is blocked.
- [ ] Payments list and filters; partial refund → Cashfree refund + credit note.
- [ ] Audit shows every owner write with its reason.
- [ ] App settings: maintenance mode blocks non-owners (503 in the app shows the maintenance screen); announcement banner; push announcement to an audience; GST seller details on the next invoice; usage reset day.

## 13. Hand-back

Commit in small PRs, in this order:

1. schema + seed
2. entitlements + quota wiring
3. receipt pipeline fields
4. saas + pricing + Cashfree
5. owner
6. cron
7. tests

Update `README.md` with the env vars and the sandbox test steps. Then report back with:

- the passing `npm run test:all` output
- one sandbox payment ID each for success, failure and refund

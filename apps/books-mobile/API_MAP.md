# Byjan Books mobile — API map and integration notes

`apps/books-mobile` is the Byjan Books app rebuilt from the Claude Design prototype (*Byjan Books Prototype*). It is a separate Vite + React + Capacitor app that calls the same `/api` as the web app. It uses the same `appId` (`com.byjanbooks.app`), so a release build from here replaces the current Play Store app. The existing web app, its `android/` project and the Vercel deploy are unchanged.

## Every API the app calls

Every `(endpoint, op)` the app sends has a server handler. Re-check after changes with:

```bash
python3 scripts/mobile-api-audit.py apps/books-mobile/src .
```

The script exits non-zero if the app calls an op the server doesn't implement.

| Endpoint | Server handler | Ops the app calls |
|---|---|---|
| `/api/expenses` | api/tracker.ts → handleExpenses | `checkDuplicate`, `create`, `list`, `listAll`, `softDelete`, `update` |
| `/api/invites` | api/invites.ts + api/_lib/invite-links.ts | `accept`, `create` |
| `/api/ledgers` | api/tracker.ts → handleLedgers | `auditList`, `create`, `ensureMailbox`, `forgetBook`, `get`, `list`, `mailList`, `removeMember`, `softDelete`, `update` |
| `/api/me` | api/tracker.ts → handleMe | `deleteAccount`, `get`, `upsert` |
| `/api/money` | api/_lib/money-handlers.ts, money-extras.ts (inbox, insights, learnCorrection) | `confirmSettlementReceived`, `dismissInbox`, `insights`, `learnCorrection`, `listInbox`, `listMemberUpi`, `listMySettlements`, `listSettlements`, `listTimeline`, `markSettlementReview`, `nlSearch`, `parseCapture`, `processReceipt`, `rankContexts`, `reportSummary`, `reportUpiReturn`, `requestMemberUpi`, `saveMyUpi`, `saveSplit`, `startUpiPayment` |
| `/api/notifications` | api/tracker.ts → handleNotifications | `list`, `markAllRead`, `markRead`, `registerPush` |
| `/api/owner` | api/_lib/owner-handlers.ts (super users only) | `archivePlan`, `getConfig`, `getUser`, `grantQuota`, `listAudit`, `listOffers`, `listPayments`, `listPlans`, `listUsers`, `overview`, `refund`, `resetUsage`, `saveAddon`, `saveConfig`, `saveOffer`, `savePlan`, `sendAnnouncement`, `setUserFeatures`, `setUserPlan`, `setUserStatus`, `usageReport` |
| `/api/saas` | api/_lib/saas-handlers.ts | `cancel`, `catalog`, `changeSeats`, `createOrder`, `invoicePdf`, `listInvoices`, `me`, `publicConfig`, `quote`, `resume`, `startTrial`, `updateBilling`, `validateCoupon`, `verifyOrder` |
| `/api/email/send-report` | server.ts (Express) / api/email/send.ts (Vercel) | `{to, subject, message, pdfBase64, filename, bookId}` |
| `/api/blob/upload`, `/api/blob/file` | api/blob/*.ts | receipt and attachment files |

Routing:
- **Vercel:** `vercel.json` rewrites `/api/<domain>` to `api/tracker.ts?domain=<domain>`. That includes the new `/api/saas` and `/api/owner`, plus `/api/payments/cashfree/webhook`, `/pay/cashfree` and `/pay/return`.
- **Express** (`server.ts`, used by `npm start` and Render): the same routes are registered there too.

## Fixes made while mapping

1. **Express was missing routes.** `server.ts` never registered `/api/money` (Vercel did), so splits, settlements, UPI, receipt capture, inbox and reports failed when served by Express. The new `/api/saas`, `/api/owner` and Cashfree routes are now registered as well. The webhook runs before the JSON parser, because Cashfree's signature is checked over the raw body. A handler error now returns 500 instead of crashing the process.
2. **`reportSummary` returned the old shape.** The new Reports screen and the book Reports tab read `inPaise`, `outPaise`, `byCategory`, `byMonth`, `byMethod` and `topMerchants`, and send `from`/`to`. Without those fields the Reports screen crashed. The server now honours the date range and returns the breakdown in integer paise. The old fields (`moneyOut`, `moneyIn`, `net`, `count`) are kept, and callers that send no range get the same numbers as before.
3. **"Email PDF report" sent the wrong payload.** The app sent `{bookId, month, to}`, but the server requires `subject` and `message` and attaches `pdfBase64`. Every request failed with "Missing required fields". The app now builds the PDF on the device (`src/lib/report-pdf.ts`, jsPDF, loaded on demand) and sends the full payload.
4. **Invites:**
   - Link invites were issued as `/join/<code>`, but neither app had that route. They are now `/invite/<code>`. Old `/join/` links still work: the mobile app redirects them and handles them as deep links, and the web app has a `/join/:inviteId` route.
   - Email invites returned no `link`, so the People screen showed `…/invite/undefined`. They now return `link: <app>/invite/<id>`.
   - `accept` and `peek` accept either a link code or an email-invite id under `code` or `id`, so one `/invite/:x` URL works for both kinds on web and mobile.
5. **`saas.publicConfig`** runs on every launch without sign-in. It now returns a 503 if the database is unavailable, instead of throwing an unhandled error.
6. **Type error in the share receiver.** `src/lib/share.ts` had a type error that blocked `npm run build` (`tsc --noEmit && vite build`). Fixed.

## Backend added from the design export

These are additive and were checked line by line against `main` before overlaying, so nothing newer on `main` is lost:
- SaaS plans and entitlements: `api/_lib/saas-*.ts`, `pricing.ts`, `entitlements.ts`, `billing.ts`
- Cashfree: `api/_lib/cashfree.ts`, `api/payments/*`
- Owner console: `api/_lib/owner-handlers.ts`
- Inbox, insights and learn-from-corrections: `api/_lib/money-extras.ts`
- Link invites: `api/_lib/invite-links.ts`
- Quota checks in `tracker.ts`, `invites.ts`, `email/inbound.ts` and `blob/upload.ts`
- Tests: `scripts/pricing-test.ts`, `scripts/saas-test.ts`

New tables are created on first request with `CREATE TABLE IF NOT EXISTS`.

Set these on Vercel (Production and Preview) before switching billing on:

```
CASHFREE_APP_ID=
CASHFREE_SECRET_KEY=
CASHFREE_ENV=sandbox
CASHFREE_WEBHOOK_SECRET=
PUBLIC_APP_URL=https://www.easypado.com
CRON_SECRET=
```

In the Cashfree dashboard, set the webhook URL to `https://www.easypado.com/api/payments/cashfree/webhook`.

## Verified on this branch

- `npx tsc --noEmit` (root): no new errors versus `main`. `main` already had 30 unrelated errors; they are unchanged.
- `apps/books-mobile`: `npm run build` (typecheck and Vite build) passes.
- `npx vite build` (web app) passes.
- Tests:
  - Pass: `pricing`, `upi`, `recurrence`, `purpose-intelligence`, `books-flow`, `security-e2e`.
  - Fail on `main` too, with identical results: `money-test` (`what-if saving > 0`) and the receipt mass-corpus check (9014/10000). Not changed here.
- Express smoke test:
  - `/api/money`, `/api/saas`, `/api/owner` reach their handlers (401 without sign-in).
  - The webhook rejects unsigned calls.
  - `/pay/return` renders.
  - The server survives handler errors.

## Not covered yet

- **Live device test.** Nothing here was run on a phone or against the production API. Follow `ANDROID_TEST_CHECKLIST.md` on a preview deploy.
- **Android project.** `npx cap add android` hasn't been run for this app. Copy `google-services.json`, the release keystore and `android-native/*` as described in `README.md`.
- **`saas-test.ts`.** It needs a deployed preview: `API_URL=<preview url> npm run test:saas`.

# Byjan Books — mobile app (React + Capacitor, Android)

This is a clean rebuild of the Byjan Books app. It calls the **same** `api/` (Vercel + Neon) as the `expense-tracker` repo, and uses the same `appId` (`com.byjanbooks.app`), so it replaces the Play Store app when installed.

## Run

```bash
cp .env.example .env          # fill Firebase web config + VITE_API_URL
npm install
npm run dev                   # web preview, /api proxied to VITE_API_URL
npx cap add android           # first time only
cp android-native/*.java android/app/src/main/java/com/byjanbooks/app/
# merge android-native/AndroidManifest.additions.xml into android/app/src/main/AndroidManifest.xml
npm run cap:run               # build + install on a device
```

Copy `google-services.json` and the release keystore from the old `android/` folder.

## What's inside

**Capture → auto-fill**
- Ways to capture: Android share sheet (single or up to 10 files), camera, gallery, PDF/Excel, pasted SMS, voice, email-in, and manual entry.
- Every field on the entry form is filled from the server's `processReceipt` preview, plus instant on-device extraction.
- Filled fields glow teal. Low-confidence fields are amber with a "Check this" tag.
- Batches open one form after another ("1 of 5").
- Includes a duplicate guard, offline queue, and learning from corrections.

**Books**
- Home, books, ledger with swipe actions, filters, months, and search (including smart search).
- Entry detail with receipt viewer and timeline.
- Splits four ways; settle up by UPI intent (PhonePe, Google Pay, Paytm, BHIM).
- People and invites, book settings (categories, accounts, budget, mailbox).
- Reports with smart insights, inbox, notifications.

**Account and app**
- Settings: UPI ID, alerts, PIN app lock, delete account.
- Sign in with email or Google, email verification, password reset.

**Plans and payments**
- Plans screen (monthly/annual, seats, top-ups, offer banner).
- Checkout with coupon and GSTIN, paid through Cashfree.
- Payment result, billing (cancel/resume, seats, invoices), usage meters.
- A paywall opens whenever a limit is hit.

**Owner console** (super users only, from Settings → Owner console)
- Overview and users with per-person feature access.
- Plans with limits and per-plan features; top-ups; offers and coupons.
- Usage, payments and refunds, audit log, app settings (maintenance, announcements, GST, trial).

**Motion** (`src/motion.tsx`)
- Spring page transitions, staggered lists, shared-layout tabs and nav pill.
- Drag-to-dismiss sheets, swipe rows, pull-to-refresh with the Byjan mark.
- Receipt scan beam, auto-fill glow, count-up totals, animated meters.
- Success check with confetti, haptics on every press.
- Respects reduced-motion settings.

**Brand**
- `/public/brand/*`: Byjan logo, mark, app icons.
- `/public/brands/*`: UPI app logos (PhonePe, GPay, Paytm, BHIM, Amazon Pay, CRED, MobiKwik, UPI, WhatsApp).

## Backend

`BACKEND_PROMPT.md` lists every endpoint, field, quota, payment and owner operation this app calls, with acceptance checks. Give it to Cursor or Devin in the `expense-tracker` repo. Endpoints that don't exist yet return errors the app handles gracefully, but the flows only fully work once that prompt is done.

## Known platform limits

- **SMS:** Play policy forbids `READ_SMS` for this type of app. Bank and UPI SMS come in through Share or Paste instead.
- **Voice:** uses the WebView speech API where available. Otherwise it falls back to typing.

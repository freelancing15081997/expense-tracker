# Progress

## Phase 1
Installed the Expo SDK 57 app from `byjan-app.zip` into `byjan/`. `npx tsc --noEmit` passes. `npx expo-doctor` passes after removing `newArchEnabled` (SDK 57 turns the New Architecture on by default). Web preview runs with `npx expo start --web --port 8082`. Checked splash, skip, sign-in, OTP `246810`, Home, Books, Settle, Insights, You, a book, add entry, split, UPI pay, and PIN `2580`. Simulate API failures blocks a save with the connection error. This Windows PC has no iOS simulator, and an Android emulator was not started.

## Phase 2
Camera, gallery, file picker, voice recording, UPI QR debounce, fingerprint unlock, push registration, UPI intent plus a 2s/60s status poll, share links, and real network state are wired without changing the screen layout. Images are capped at 1600px and quality 0.7, and files over 10 MB are refused. Offline entry creates are queued and flushed when the network returns. SMS reading stays behind `EXPO_PUBLIC_SMS=1` and is Android-only.

## Phase 3
`byjan/server` is Fastify and implements the API.md routes plus receipt, voice, share, document and import uploads. Auth is a console OTP (`246810`), a 15-minute access token and a rotating 30-day refresh token. The app refreshes once on 401. Money splits are integer paise. A payment is `SUCCESS` only after a signed webhook, or after the server's own sandbox status check when `PAYMENT_SANDBOX=1`. Zod checks OTP, entry and UPI intent bodies. Postgres persistence is the Prisma `AppState` document; without `DATABASE_URL` the design seed stays in memory. Mocks still run when `EXPO_PUBLIC_API_URL` is empty or `EXPO_PUBLIC_USE_MOCKS=1`.

## Phase 4
Server tests cover paise rounding, smart settle, token refresh rotation and webhook signatures (8 passing). Jest covers the mock client, 401 refresh, the offline entry queue, the query cache, and one render of each space. Maestro flows are in `byjan/.maestro/`. `npx expo lint` is clean. GitHub Actions workflow `.github/workflows/byjan.yml` typechecks, lints and tests the app and the server.

## Phase 5
Animations already use transform and opacity. `CADisableMinimumFrameDurationOnPhone` stays on. Lists in the design seed are under 50 rows, so they stay on the current scroll views. FlashList is the swap once a list can pass that. A release-build frame-time pass was not run on a phone.

## Phase 6
Icons use the graphite background `#0A0C0F`. Bundle ids are `app.byjan.ios` and `app.byjan.android`. Privacy strings and `PRIVACY.md` are in place. Sentry and Cashfree are not bundled yet: Metro cannot import a package that is not installed, and both need owner keys plus a dev build. `eas.json` has development, preview and production profiles. `eas build` was not run from this machine.

## Needs from owner
- Confirm bundle ids `app.byjan.ios` and `app.byjan.android`.
- Cashfree sandbox app id and secret, then add `react-native-cashfree-pg-sdk` on a dev build. Checkout still calls `billingApi.verifyOrder`. Keys stay in `byjan/server/.env`.
- SMS: apply for Google Play's SMS permission exception, or use an Account Aggregator (Setu / Finvu). Until then leave `EXPO_PUBLIC_SMS` unset.
- OCR, voice and screenshot parsing currently return the design's sample read. Choose the production provider.
- Sentry DSN and `@sentry/react-native` on a dev build. Expo account for `eas build --profile preview`, and an Apple developer account. Preview install links are not generated from this Windows machine.
- `expo-share-intent` on a dev build for the Android share sheet. `byjan://share` and `https://byjan.app/j/:code` already route in the app.
- iPhone and a release-build frame-time pass were not run here.

## How to run
```
cd byjan
npm install
npx expo start --web
```
Server, from `byjan/`:
```
docker compose up
```
or, without Docker:
```
cd byjan/server
npm install
npm test
npm run dev
```
Set `EXPO_PUBLIC_API_URL=http://localhost:4000` to leave mock mode.

## Verified
App typecheck, Expo doctor (21 checks), Expo lint, Jest (client, cache, five spaces), and server tests. Web click-through of sign-in, spaces, book, add, split, pay, PIN and simulated failure. Could not run the iOS simulator, an Android emulator, Maestro, or an EAS preview build from this PC.

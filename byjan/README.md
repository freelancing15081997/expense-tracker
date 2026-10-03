# Byjan — React Native app

Expo (SDK 57) + TypeScript implementation of the Byjan "Graphite & Mint" design: shared books, splits, settle-up on UPI, scan/voice capture, insights, business admin and every error state. ~50 screens, dark and light themes.

## Run it

```bash
npm install
npx expo start          # press i / a for a simulator, or scan the QR with a dev build
npx expo start --web    # browser preview with phone frame + screen index
```

The app runs fully on mock data out of the box.

## Connect a backend

```bash
EXPO_PUBLIC_API_URL=https://api.byjan.app npx expo start
```

- `src/api/client.ts` — fetch wrapper (bearer token, JSON, `ApiError`, multipart upload). When `EXPO_PUBLIC_API_URL` is unset (or `EXPO_PUBLIC_USE_MOCKS=1`) every call returns its mock instead.
- `src/api/services/*.ts` — one function per endpoint, each marked `PLACEHOLDER: METHOD /path`. **See [API.md](./API.md) for the full list (102 endpoints).**
- `src/api/types.ts` — request/response shapes the screens rely on.
- `src/api/mocks.ts` — the design's sample data.

Native integrations that need a real SDK are marked `PLACEHOLDER` inline in the screens:

| Where | What to plug in |
|---|---|
| `screens/capture.tsx` · Scan | `expo-camera` `CameraView.takePictureAsync()` → `captureApi.scanReceipt` |
| `screens/capture.tsx` · Voice | `expo-audio` recording → `captureApi.parseVoice` |
| `screens/pay.tsx` · Scan & pay | `expo-camera` `onBarcodeScanned` → `paymentsApi.parseQr` |
| `screens/pay.tsx` · Pay | UPI intent deep link (already opened via `Linking`) + status polling |
| `screens/business.tsx` · Checkout | Cashfree PG SDK with `paymentSessionId` |
| `screens/business.tsx` · Import, `tools.tsx` · Documents | `expo-document-picker` / `expo-image-picker` |
| `screens/auth.tsx` · Push permission | `expo-notifications` permission + token → `notificationsApi.registerDevice` |

## Motion & gestures

Built on Reanimated 4 + Gesture Handler, ported from the prototype's own keyframes and curves (`src/components/motion.tsx`).

- **Spaces pager** (`src/screens/SpacesScreen.tsx`): Home, Books, Settle, Insights and You are one pager. Drag anywhere; the page follows your finger with a 3D tilt and commits after ~40px or a light flick (300 px/s). It wraps around, ticks a haptic at the half-way point, and the dock label and dots track your finger.
- **Dock**: drag sideways to switch spaces, swipe up or tap for Go to. **Orb**: tap for the quick-add orbit (it springs into ×), swipe up to scan a bill.
- **Everywhere**: spring press on every tappable surface, staggered entrances, odometer and count-up numbers, keypad digit bump, shake on errors, sliding segmented controls, spring toggles, drag-to-dismiss sheets, swipe-up toasts with a countdown bar, slide-to-pay, a confetti success screen and a perforated receipt.
- Releasing a drag never registers as a tap (`markDrag` / `wasDragging`). Reduced-motion settings disable the decorative loops.

## Prototype v2 changes (ported)

- **Books list** (`FlatBook` in `src/components/brand.tsx`): flat book with spine, two page leaves (`pgFan`), status bookmark tab (`bmDrop`), 40 ms stagger (`bkDeal`), 2px progress. Home keeps the colourful cards.
- **macOS-style open** (`src/components/BookMorph.tsx`): tapping a book grows the detail out of it (440 ms, cubic-bezier(.16,1,.3,1)); every way back (button, Android back, swipe, `goBack`) shrinks it into the same book (300 ms). Book is a transparent modal for these opens, so the list stays underneath. Opened from Home it slides normally.
- **Book hero shows the tapped book**: gradient, kicker, total, budget %, primary and secondary stat (`bookDetailFor` in mocks).

## Performance

- Animations touch transform and opacity only (progress bars scale, sparkline reveals with a clip). Nothing relays out per frame.
- Spaces are memoised and the pager context is stable, so switching spaces moves transforms without re-rendering pages. Decorative loops pause on hidden spaces and under quick add.
- A stale-while-revalidate query cache (`src/hooks/useApi.ts`) means revisited screens paint instantly. Books prefetch their detail on touch-down.
- 120 Hz on iPhone ProMotion via `CADisableMinimumFrameDurationOnPhone` (app.json); Reanimated drives everything on the UI thread at the display's refresh rate.

## Dev tools

Profile → Developer → **Simulate API failures** makes every placeholder call fail, so you can see each error path (payment failed, scan failed, invite expired, offline…).

Demo codes: OTP `246810`, PIN `2580`, coupon `BYJAN20` (`DIWALI10` shows the expired case).

## Structure

```
App.tsx                     fonts, providers, web preview frame
src/navigation/             native-stack navigator + route params (Spaces is one route)
src/screens/
  auth.tsx                  splash, onboarding, sign in, OTP, forgot, setup, PIN lock, join, push ask
  home.tsx                  Home space
  spaces.tsx                Books, Settle, Insights, You (+ New book sheet)
  book.tsx                  Book detail (entries / balances / stats, invite sheet), Entry detail
  capture.tsx               Add entry, Split, Scan, Voice, Share-in
  SpacesScreen.tsx          the 5-space pager, dock, orb, quick-add orbit, Go to sheet
  pay.tsx                   Pay on UPI, Success, Scan & pay, Request money
  tools.tsx                 Accounts, Bills, Activity, Notifications, Search, Needs a look, Documents, Bank SMS, Usuals, Recurring, Notification prefs
  business.tsx              Plans, Checkout, Help, Roles, Admin, Import
  errors.tsx                Offline, Payment failed, Server error, Scan failed, Invite expired, Plan limit
src/components/             UI kit (ui.tsx), brand pieces (dock, FAB, book card, charts), icon registry
src/api/                    client, services, types, mocks
src/theme/tokens.ts         colours, fonts, avatar palette (from the design)
```

Navigation uses React Navigation's native stack. If you prefer Expo Router, each screen export maps 1:1 to a route file.

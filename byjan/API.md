# Byjan API placeholders

Every call the app makes goes through `src/api/client.ts`. Until `EXPO_PUBLIC_API_URL` is set, each one returns the mock in `src/api/mocks.ts` after a short delay. Point the env var at your backend and implement the endpoints below; request/response shapes are the TypeScript types in `src/api/types.ts`.

**102 endpoints**

| Service | Function | Method | Path | Notes |
|---|---|---|---|---|
| `authApi` | `sendOtp` | POST | `/v1/auth/otp/send` | sends a 6-digit SMS OTP. |
| `authApi` | `verifyOtp` | POST | `/v1/auth/otp/verify` | returns a session token. Demo code: 246810. |
| `authApi` | `signInWithGoogle` | POST | `/v1/auth/oauth/google` | exchange a Google ID token for a session. |
| `authApi` | `forgotPassword` | POST | `/v1/auth/password/forgot` | emails a reset link. |
| `authApi` | `verifyPin` | POST | `/v1/auth/pin/verify` | app-lock PIN check. Demo PIN: 2580. |
| `authApi` | `logout` | POST | `/v1/auth/logout` |  |
| `authApi` | `unlockWithBiometrics` | POST | `/v1/auth/session/unlock` | after a successful on-device biometric check (expo-local-authentication `authenticateAsync`), exchange the device-bound key for a fresh session. |
| `authApi` | `revokeOtherSessions` | POST | `/v1/auth/sessions/revoke-others` | "Secure account" from a security alert. |
| `profileApi` | `get` | GET | `/v1/me` |  |
| `profileApi` | `update` | PATCH | `/v1/me` | profile setup (name, UPI ID). |
| `profileApi` | `updatePrefs` | PUT | `/v1/me/preferences` | app lock, biometrics, alerts, daily summary. |
| `profileApi` | `validateUpi` | POST | `/v1/upi/validate` | resolve a VPA before saving it. |
| `booksApi` | `list` | GET | `/v1/books` |  |
| `booksApi` | `create` | POST | `/v1/books` |  |
| `booksApi` | `get` | GET | `/v1/books/:id` |  |
| `booksApi` | `entries` | GET | `/v1/books/:id/entries?filter=&q=` |  |
| `booksApi` | `balances` | GET | `/v1/books/:id/balances` |  |
| `booksApi` | `invite` | POST | `/v1/books/:id/invites` | email/phone invites with a role. |
| `booksApi` | `inviteLink` | GET | `/v1/books/:id/invite-link` |  |
| `booksApi` | `roles` | GET | `/v1/books/:id/roles` | current permissions, approval limit and member count per role. |
| `booksApi` | `updateRole` | PUT | `/v1/books/:id/roles/:role` | permissions + approval limit. |
| `entriesApi` | `get` | GET | `/v1/entries/:id` |  |
| `entriesApi` | `create` | POST | `/v1/entries` |  |
| `entriesApi` | `update` | PATCH | `/v1/entries/:id` |  |
| `entriesApi` | `remove` | DELETE | `/v1/entries/:id` |  |
| `entriesApi` | `restore` | POST | `/v1/entries/:id/restore` | powers "Undo" after delete. |
| `entriesApi` | `addNote` | POST | `/v1/entries/:id/notes` |  |
| `entriesApi` | `shareCard` | GET | `/v1/entries/:id/share-card` | server-rendered image of the entry for the share sheet. |
| `entriesApi` | `suggest` | GET | `/v1/entries/suggest?amount=` | "same as last time" autofill. |
| `invitesApi` | `get` | GET | `/v1/invites/:code` |  |
| `invitesApi` | `summary` | GET | `/v1/invites/:code/summary` | book name, inviter and expiry, available even after the link expires. |
| `invitesApi` | `accept` | POST | `/v1/invites/:code/accept` |  |
| `invitesApi` | `requestNew` | POST | `/v1/invites/:code/request-new` | ask the inviter for a fresh link. |
| `contactsApi` | `list` | GET | `/v1/contacts` | people you share books with (name, short name, UPI ID). |
| `billingApi` | `plans` | GET | `/v1/plans` |  |
| `billingApi` | `usage` | GET | `/v1/billing/usage` |  |
| `billingApi` | `subscription` | GET | `/v1/billing/subscription` | current plan and renewal date. |
| `billingApi` | `verifyOrder` | POST | `/v1/billing/orders/:id/verify` | confirm a Cashfree order server-side after the SDK returns. |
| `billingApi` | `validateCoupon` | POST | `/v1/billing/coupons/validate` |  |
| `billingApi` | `checkout` | POST | `/v1/billing/checkout` | creates a Cashfree order; open `paymentSessionId` with the Cashfree SDK. |
| `billingApi` | `startTrial` | POST | `/v1/billing/trial` |  |
| `billingApi` | `restore` | POST | `/v1/billing/restore` | restore store purchases. |
| `adminApi` | `overview` | GET | `/v1/books/:id/admin/overview` |  |
| `adminApi` | `approvals` | GET | `/v1/books/:id/approvals` |  |
| `adminApi` | `decide` | POST | `/v1/approvals/:id` | approve | reject (reason required) |
| `adminApi` | `setPolicies` | PUT | `/v1/books/:id/policies` |  |
| `importApi` | `commit` | POST | `/v1/import/:id/commit` | column mapping + fixes. |
| `supportApi` | `faq` | GET | `/v1/support/faq?q=` |  |
| `supportApi` | `tickets` | GET | `/v1/support/tickets` |  |
| `supportApi` | `create` | POST | `/v1/support/tickets` |  |
| `dashboardApi` | `home` | GET | `/v1/home` | spend this month, trend, attention count, today's feed. |
| `dashboardApi` | `sync` | POST | `/v1/sync` | pull-to-refresh (re-reads bank SMS, books). |
| `dashboardApi` | `insights` | GET | `/v1/insights?month=Sep` |  |
| `dashboardApi` | `activity` | GET | `/v1/activity?mine=` |  |
| `dashboardApi` | `search` | GET | `/v1/search?q=&type=` |  |
| `dashboardApi` | `recentSearches` | GET | `/v1/search/recent` |  |
| `dashboardApi` | `health` | GET | `/v1/health` | server reachability for the offline screen (pair with @react-native-community/netinfo for device Wi-Fi/data state). |
| `dashboardApi` | `ask` | POST | `/v1/ask` | natural-language question ("what did I spend on food?"). |
| `notificationsApi` | `list` | GET | `/v1/notifications` |  |
| `notificationsApi` | `markAllRead` | POST | `/v1/notifications/read-all` |  |
| `notificationsApi` | `dismiss` | POST | `/v1/notifications/:id/dismiss` |  |
| `notificationsApi` | `registerDevice` | POST | `/v1/push/devices` | register Expo/FCM/APNs push token. |
| `notificationsApi` | `prefs` | GET | `/v1/push/preferences` |  |
| `notificationsApi` | `savePrefs` | PUT | `/v1/push/preferences` |  |
| `notificationsApi` | `sendTest` | POST | `/v1/push/test` |  |
| `reviewApi` | `attention` | GET | `/v1/review` | duplicates, unusual amounts, uncategorised. |
| `reviewApi` | `resolve` | POST | `/v1/review/:kind/resolve` | keep | merge | confirm | category |
| `captureApi` | `smsQueue` | GET | `/v1/sms/queue` | transactions parsed on-device from bank SMS, pending review. |
| `captureApi` | `smsAction` | POST | `/v1/sms/queue/:id` | add | ignore |
| `captureApi` | `smsAddAll` | POST | `/v1/sms/queue/add-all` |  |
| `captureApi` | `parseShared` | POST | `/v1/share/parse` | parse a screenshot shared from GPay/PhonePe into the app. |
| `vaultApi` | `list` | GET | `/v1/documents?folder=&q=` |  |
| `vaultApi` | `url` | GET | `/v1/documents/:id/url` | signed download URL. |
| `templatesApi` | `list` | GET | `/v1/templates` |  |
| `templatesApi` | `create` | POST | `/v1/templates` |  |
| `templatesApi` | `remove` | DELETE | `/v1/templates/:id` |  |
| `templatesApi` | `use` | POST | `/v1/templates/:id/use` | creates an entry from the template. |
| `recurringApi` | `list` | GET | `/v1/recurring` |  |
| `recurringApi` | `setPaused` | PATCH | `/v1/recurring/:id` | pause/resume |
| `recurringApi` | `suggestion` | POST | `/v1/recurring/suggestions/:name` | track | ignore |
| `settleApi` | `summary` | GET | `/v1/settle` | net position + simplified debts across all books. |
| `settleApi` | `remind` | POST | `/v1/settle/remind` | WhatsApp/SMS nudge. |
| `settleApi` | `dismissNudge` | POST | `/v1/nudges/:id/dismiss` | hide a "X owes you" nudge on Home. |
| `settleApi` | `markSettled` | POST | `/v1/settle/mark` | record a cash/off-app settlement. |
| `paymentsApi` | `createIntent` | POST | `/v1/payments/upi/intent` | create a UPI intent (deep link) for GPay/PhonePe/Paytm. The native app opens `intentUrl`; the backend confirms status via PSP webhook. |
| `paymentsApi` | `status` | GET | `/v1/payments/:id` | poll for status after returning from the UPI app. |
| `paymentsApi` | `receipt` | GET | `/v1/payments/:id/receipt` | shareable receipt image for a completed payment. |
| `paymentsApi` | `recentPayees` | GET | `/v1/payments/recent-payees` | quick picks on Scan & pay. |
| `paymentsApi` | `resolveVpa` | POST | `/v1/upi/resolve` | look up a typed UPI ID (name + verified merchant flag) before paying. |
| `paymentsApi` | `parseQr` | POST | `/v1/upi/qr/parse` | decode a scanned UPI QR payload into a payee. |
| `paymentsApi` | `request` | POST | `/v1/requests` | request money via WhatsApp link or UPI collect. |
| `paymentsApi` | `declineRequest` | POST | `/v1/requests/:id/decline` |  |
| `accountsApi` | `list` | GET | `/v1/accounts` | balances from SMS parsing / manual cash. |
| `accountsApi` | `statement` | GET | `/v1/accounts/:id/transactions` | statement for one account. |
| `accountsApi` | `transfer` | POST | `/v1/accounts/transfer` |  |
| `accountsApi` | `addCash` | POST | `/v1/accounts/cash` | adjust cash in hand. |
| `billsApi` | `list` | GET | `/v1/bills?month=` |  |
| `billsApi` | `create` | POST | `/v1/bills` | add a bill or due (name, amount, due day of month). |
| `billsApi` | `pay` | POST | `/v1/bills/:id/pay` | pay a biller (BBPS / UPI biller). Returns a UPI intent the app opens, then poll paymentsApi.status like any other payment. |
| `billsApi` | `markPaid` | POST | `/v1/bills/:id/paid` |  |
| `billsApi` | `unmarkPaid` | DELETE | `/v1/bills/:id/paid` | undo. |
| `billsApi` | `snooze` | POST | `/v1/bills/:id/snooze` |  |

## Device-only (no endpoint)

- Torch on Scan screens — `expo-camera` `enableTorch`.
- Opening the mail app after a reset link — `Linking`.
- Theme, hide-amounts and local haptics are applied instantly on device; theme is also saved via `profileApi.updatePrefs`.

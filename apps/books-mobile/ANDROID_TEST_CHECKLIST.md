# Byjan Books Android test checklist

Run every row on a real Android phone (Android 10+), using a **release-signed build** so Google sign-in uses the Play SHA-1. Point the app at the preview API, with `CASHFREE_ENV=sandbox`.

Each row has a Pass, Fail or N/A box. If a row fails, note the device, the steps and a screenshot.

**Devices:** one budget phone (e.g. Redmi / Samsung A, 3–4 GB RAM) and one recent phone (Pixel / OnePlus). Also do one pass with **system font at largest** and one in **dark mode**.

---

## 0. Install & first run
| # | Step | Expected | ☐ |
|---|---|---|---|
| 0.1 | Install over the old Play Store app (same `com.byjanbooks.app`) | Upgrades in place, existing login kept or asks once | ☐ |
| 0.2 | Fresh install, open | Splash with Byjan mark, then sign-in. No white flash | ☐ |
| 0.3 | Deny notification permission | App works; Settings shows "Alerts off" with a turn-on link | ☐ |
| 0.4 | Airplane mode on first open | Friendly offline message, no crash | ☐ |

## 1. Sign in
| # | Step | Expected | ☐ |
|---|---|---|---|
| 1.1 | Google sign-in | Account picker opens, signs in. Cancelling shows "Cancelled" | ☐ |
| 1.2 | Email sign-up | Verification email arrives. App waits until "I've verified" | ☐ |
| 1.3 | Resend verification twice quickly | Second tap is blocked for 30 s | ☐ |
| 1.4 | Wrong password / unknown email / 6 wrong tries | Three different friendly messages | ☐ |
| 1.5 | Forgot password | Email arrives, link resets, new password works | ☐ |
| 1.6 | New user | Gets the Free plan (or Pro trial if turned on in the Owner console) | ☐ |

## 2. Books & entries
| # | Step | Expected | ☐ |
|---|---|---|---|
| 2.1 | Create a book (Trip purpose, INR) | Trip categories pre-filled | ☐ |
| 2.2 | Create books until you pass the Free limit (5) | 6th shows the paywall, not an error | ☐ |
| 2.3 | Add an entry with every field filled | Reopen it: every field is still there | ☐ |
| 2.4 | Swipe left / right on an entry | Delete with Undo / Duplicate (date reset, UPI ref cleared) | ☐ |
| 2.5 | Same amount, same date, same UPI ref | "Looks like a duplicate"; "Save anyway" works | ☐ |
| 2.6 | Transfer with the same from/to account | Blocked with a message | ☐ |
| 2.7 | Airplane mode, add 3 entries, back online | All 3 sync once, no duplicates | ☐ |
| 2.8 | Pull to refresh | Byjan mark animates, list refreshes | ☐ |
| 2.9 | Export CSV | Android share sheet opens with the file | ☐ |

## 3. Receipt auto-fill (the key flow)
| # | Step | Expected | ☐ |
|---|---|---|---|
| 3.1 | PhonePe success screenshot → Share → Byjan | Opens the form with amount, date, time, payee, UPI ref, payee UPI ID, paid from (bank ••last4 via PhonePe), UPI method and category filled. Filled fields glow | ☐ |
| 3.2 | Same with Google Pay and Paytm | Same fields filled | ☐ |
| 3.3 | Long-press a bank debit SMS → Share → Byjan | Money out, amount, account ••last4, ref | ☐ |
| 3.4 | Credit SMS | Direction is **money in** | ☐ |
| 3.5 | Restaurant bill photo (camera) | Scan beam shows; items in notes, GST, bill number | ☐ |
| 3.6 | PDF invoice from Gmail → Share | Invoice number, GST, document type "invoice" | ☐ |
| 3.7 | Gallery: pick 5 screenshots | Forms open "1 of 5" … "5 of 5", each filled | ☐ |
| 3.8 | Blurry photo | Low-confidence fields are amber with "Check this"; the item also appears in Inbox | ☐ |
| 3.9 | Voice: "paid 450 for diesel by UPI" | ₹450, Fuel, UPI. On a phone without speech support, falls back to typing | ☐ |
| 3.10 | Change a category for merchant X, then scan X again | New receipt gets the corrected category | ☐ |
| 3.11 | Use all Free scans (30), then scan | Paywall. Manual entry still works | ☐ |
| 3.12 | Kill the network mid-scan | Error; scan count **not** used (check Plan & usage) | ☐ |
| 3.13 | Forward a bill to the book's email address | Entry appears (or lands in Inbox if over the limit) | ☐ |

## 4. Splits & settle
| # | Step | Expected | ☐ |
|---|---|---|---|
| 4.1 | Equal / exact / percent / shares | Exact must add up; percent must total 100 | ☐ |
| 4.2 | Pay via PhonePe, GPay, Paytm and BHIM | UPI app opens with amount and UPI ID filled; back in Byjan you're asked "Did it go through?" | ☐ |
| 4.3 | Payee marks "Received" | Settled on both phones | ☐ |
| 4.4 | Payee has no UPI ID → "Ask UPI" | Payee gets a push | ☐ |

## 5. People
| # | Step | Expected | ☐ |
|---|---|---|---|
| 5.1 | Invite link → share to WhatsApp → open on the 2nd phone | Joins the book | ☐ |
| 5.2 | Open the same link again | "Already in this book" | ☐ |
| 5.3 | Fill the book to the plan's member limit, then invite | Paywall for the owner; joiner sees "book is full" | ☐ |
| 5.4 | Viewer role | No add/edit buttons; direct edit is refused | ☐ |
| 5.5 | Try to change the owner's role | Refused | ☐ |

## 6. Plans & payments (Cashfree sandbox)
| # | Step | Expected | ☐ |
|---|---|---|---|
| 6.1 | Plans screen | Owner-set prices and limits, badge, seat stepper on Business, offer banner | ☐ |
| 6.2 | Start trial | Works once; a second time says "already used" | ☐ |
| 6.3 | Coupon: valid / invalid / expired / used up | Four different messages | ☐ |
| 6.4 | GSTIN `29…` vs `27…` | Karnataka → CGST + SGST; other state → IGST | ☐ |
| 6.5 | Pay with `testsuccess@gocash` | Back in app: success, new limits live, invoice email arrives | ☐ |
| 6.6 | Pay with `testfailure@gocash` | "Didn't go through"; plan unchanged | ☐ |
| 6.7 | Press back on the Cashfree page | "Payment cancelled"; nothing activated | ☐ |
| 6.8 | Kill the app right after paying, reopen | Plan is active (activated by webhook); only one invoice | ☐ |
| 6.9 | Upgrade Plus → Pro mid-month | Checkout shows a "Credit for unused Plus" line | ☐ |
| 6.10 | Business: add 2 seats | Prorated charge; remove 1 seat → applies at renewal | ☐ |
| 6.11 | Buy +100 scans | Scan limit +100 this month | ☐ |
| 6.12 | Cancel with a reason → Resume | Access stays to period end; Resume clears it | ☐ |
| 6.13 | Invoices → open a PDF | PDF opens in the viewer | ☐ |

## 7. Owner console (super user account)
| # | Step | Expected | ☐ |
|---|---|---|---|
| 7.1 | Normal account: More menu | No Owner console entry | ☐ |
| 7.2 | Super user: Owner console → Overview | Numbers match Neon (spot-check MRR and users) | ☐ |
| 7.3 | Users: search by email, name, uid | Finds them | ☐ |
| 7.4 | Turn off Scan for user B, with a reason | On B's phone (after reopening), Scan is gone and a direct API call returns 403 | ☐ |
| 7.5 | Plans: turn off Voice on Free | Every Free user loses Voice | ☐ |
| 7.6 | Plans: set Free scans to 100 | B's limit shows 100 immediately | ☐ |
| 7.7 | Give B 3 free months of Pro | B is on Pro, no charge | ☐ |
| 7.8 | Suspend B | B is signed out and sees "Your account is paused". Restore → B can sign in | ☐ |
| 7.9 | Try to suspend yourself | Blocked | ☐ |
| 7.10 | Any owner action with an empty reason | Blocked, asks for a reason | ☐ |
| 7.11 | Partial refund ₹50 | Shows in Cashfree; credit note in B's invoices | ☐ |
| 7.12 | Maintenance mode on | B sees the maintenance screen; owner still works | ☐ |
| 7.13 | Send an announcement with push | B gets the push and an in-app banner | ☐ |
| 7.14 | Audit | Every action above, each with its reason | ☐ |

## 8. Notifications, lock, platform
| # | Step | Expected | ☐ |
|---|---|---|---|
| 8.1 | Teammate adds an entry | Push arrives; tapping it opens that book | ☐ |
| 8.2 | App lock PIN / fingerprint | Asked on reopen after 1 min in background | ☐ |
| 8.3 | Android back button on every screen | Goes back one step; never exits from inside a sheet | ☐ |
| 8.4 | Rotate / split screen | No crash; layout holds | ☐ |
| 8.5 | Largest font size | No clipped buttons or amounts | ☐ |
| 8.6 | TalkBack on Home and Add entry | Every button is labelled | ☐ |
| 8.7 | Reduce animations (Accessibility) | Motion is minimal; confetti off | ☐ |
| 8.8 | Delete account | Asks for a reason; signed out; plan cancelled | ☐ |

## 9. Performance (budget phone)
| # | Check | Target | ☐ |
|---|---|---|---|
| 9.1 | Cold start to Home | < 2.5 s | ☐ |
| 9.2 | Share screenshot → filled form | < 6 s on 4G | ☐ |
| 9.3 | Scroll a 1,000-entry book | No visible jank | ☐ |
| 9.4 | APK / AAB size | < 15 MB | ☐ |

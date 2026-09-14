# BYJAN EXPENSE TRACKER — MASTER IMPLEMENTATION PROMPT

You are modifying the existing **Byjan Expense Tracker**.

## 1. HARD CONSTRAINTS

Stack:
- Node.js + JavaScript
- Neon PostgreSQL
- Brevo
- Vercel
- NO Firebase

Rules:
- Preserve existing application and deployment.
- Do NOT rewrite working code unnecessarily.
- Do NOT remove/rename the existing Expense Tracker.
- Preserve existing custom categories, shared expenses, reports and existing behavior.
- Reuse existing auth, DB models, APIs and UI components where possible.
- Do not introduce unnecessary infrastructure.
- Prefer open-source/free solutions.
- Do not build CA/Books/ERP/accounting features.
- Expense Tracker only.

Before coding, inspect the repository and existing Expense Tracker implementation. Never assume schema/API names.

---

# 2. PRODUCT GOAL

Transform Expense Tracker into an **advanced Indian personal + family + roommate expense platform**.

Primary principle:

**Capture → Understand → Confirm → Record → Learn → Analyze**

Minimize manual entry.

Support:
- personal expenses
- income
- transfers
- cash/bank/card/wallet tracking
- UPI-related capture
- receipts
- recurring expenses
- subscriptions
- budgets
- savings goals
- shared expenses
- roommate/family groups
- settlements
- advanced reports
- intelligent insights

---

# 3. SINGLE TRANSACTION MODEL

All inputs must become the same canonical transaction.

Sources:
- manual
- receipt/image/PDF
- text
- email
- supported mobile share
- supported notification capture
- CSV/import

Do NOT create separate ledgers for different sources.

Transaction types:

`EXPENSE | INCOME | TRANSFER | REFUND | REVERSAL | CREDIT_CARD_PAYMENT | CASH_WITHDRAWAL | CASH_DEPOSIT`

Use PostgreSQL `NUMERIC` for money.

Never use JS floating-point arithmetic for financial calculations.

Transfers must not become income/expense.

Credit-card payment must not create a second expense.

Refunds should link to the original transaction when possible.

---

# 4. ADVANCED FEATURES

Implement/reuse these capabilities:

### Transactions
- fast add/edit/delete where safe
- income/expense/transfer
- custom categories/subcategories
- tags
- merchant
- account/wallet
- payment method
- notes
- attachments
- search/filter/sort
- date ranges
- recurring flag
- shared expense

### Accounts
- cash
- bank
- UPI tracking
- debit/credit cards
- wallets
- custom accounts

### Categories
- system categories
- custom categories
- subcategories
- user ordering
- archive

### Shared
- roommates
- family
- couples
- groups
- equal/custom/percentage/share split
- balances
- settlements
- reminders

### Planning
- budgets
- savings goals
- recurring expenses
- subscription detection
- upcoming commitments

### Reports
- daily/weekly/monthly/yearly/custom
- category
- merchant
- account
- payment method
- income vs spending
- trends
- budget performance
- shared expenses
- recurring expenses
- exports

---

# 5. SMART CAPTURE

Target flow:

`Share receipt/payment → Byjan → parse → preview → Add → server confirms → success`

Support where platform permits:
- PhonePe
- Google Pay
- UPI
- bank notifications
- receipt screenshots
- PDFs
- email receipts
- supported share content

Never depend on one exact notification format.

Extract when available:
- amount
- direction
- merchant
- payer/payee
- UPI/reference ID
- date/time
- provider

Directions:

`MONEY_OUT | MONEY_IN | TRANSFER | UNKNOWN`

If uncertain, use `REVIEW_REQUIRED`; never silently guess.

If login is required, preserve the incoming capture and resume after authentication.

Never show “Added” before backend persistence succeeds.

---

# 6. RECEIPT / OCR

Extract where possible:

merchant, invoice number, date, items, subtotal, discount, tax, total, payment method, currency.

Validate totals instead of blindly trusting OCR.

Keep invoice/order/payment dates separate where applicable.

Secure original documents.

---

# 7. DUPLICATES + EVIDENCE

Implement both:

### Idempotency
All financial write APIs must support an idempotency key.

### Duplicate detection
Compare:
- reference ID
- amount
- merchant
- timestamp
- account
- source
- document similarity

Do not automatically delete suspected duplicates.

Support multiple evidence sources for one transaction:

`PhonePe + bank + receipt + email → ONE transaction`

Keep evidence references.

---

# 8. INTELLIGENCE

Priority:

`User action > User rule > deterministic parser > verified mapping > history > statistical inference > AI > default`

AI can assist with:
- category
- merchant normalization
- receipt understanding
- duplicate detection
- recurring detection
- anomaly detection
- insights
- natural-language search

AI must never:
- execute arbitrary SQL
- bypass authorization
- invent financial values
- directly control financial truth
- override user corrections

Validate all AI output with strict schemas.

AI failure must never block basic expense capture.

Use deterministic logic before AI to reduce cost.

---

# 9. LEARNING

Learn from explicit user corrections.

Example:

`Amazon → user repeatedly chooses Household`

Create a user-specific rule.

Rules must be editable/deletable.

User corrections always outrank AI.

---

# 10. UNIQUE BYJAN FEATURES

Prioritize these differentiators:

### Evidence-linked transaction
Show:

`Source → extracted data → classification → user rule/history → final transaction`

### Why Byjan?
Example:

`Food`
`Merchant: Swiggy`
`Source: PhonePe`
`Previous confirmed transactions: 12`
`User rule: Food`

### Multi-source fusion
Combine notification + bank + receipt + email into one transaction.

### Spending anomaly radar
Detect unusual:
- amount
- merchant
- frequency
- duplicate
- category

### Commitment radar
Detect recurring monthly/yearly commitments.

### “Where did my money go?”
Connect income, accounts, transfers, expenses, shared expenses and savings into one understandable view.

### What-if simulator
Estimate scenarios such as:
- reducing category spending
- increasing savings
- large planned purchase

Clearly label estimates as projections.

### Natural-language search
Examples:
- “Food spending last month”
- “Above ₹5,000”
- “PhonePe expenses”
- “Where did I spend more this year?”

Use safe application queries; never execute AI-generated arbitrary SQL.

---

# 11. MOBILE UX

Make mobile:
- fast
- minimal
- touch-friendly
- premium
- one-handed
- accessible
- subtle animations
- bottom sheets
- large amounts
- clear Money Out/Money In/Transfer
- minimal typing

Avoid excessive:
- gradients
- glass effects
- animations
- fake AI effects

Support offline capture/sync if existing architecture allows it.

Use client UUID + idempotency for sync.

---

# 12. SECURITY

Server-side authorization is mandatory.

Protect against:
- IDOR
- SQL injection
- XSS
- CSRF where applicable
- SSRF
- malicious uploads
- path traversal
- replay
- duplicate writes
- prompt injection
- insecure deep links
- token/secret leakage

Never trust client-supplied ownership IDs.

Validate uploaded files using:
- MIME
- magic bytes
- size
- dimensions/page limits

Private documents require authorization on every access.

Do not store secrets in client/mobile code.

Minimize sensitive logs.

---

# 13. DATA INTEGRITY

Use:
- PostgreSQL transactions
- foreign keys
- unique constraints
- check constraints
- indexes
- conditional updates
- locks where necessary

Handle:
- double taps
- retries
- concurrent devices
- network failures

Do not use destructive deletion for confirmed financial history when reversal/void is more appropriate.

---

# 14. PERFORMANCE + COST

Optimize for existing Vercel + Neon architecture.

Use:
- indexed queries
- pagination
- selective columns
- no N+1
- efficient aggregates
- safe caching
- lazy loading
- virtualized transaction lists where needed
- debounced search

Minimize AI/OCR cost:

`deterministic → rules → history → AI only when necessary`

Do NOT add Kafka, Kubernetes, Redis, microservices or other infrastructure unless the existing application genuinely requires it.

Brevo failures must never rollback transactions.

---

# 15. DATABASE / API

First inspect the existing schema.

Extend existing tables where appropriate instead of duplicating concepts.

Potential entities only when required:

`transactions`
`transaction_sources`
`transaction_evidence`
`transaction_splits`
`accounts`
`categories`
`tags`
`recurring_rules`
`subscriptions`
`budgets`
`savings_goals`
`shared_groups`
`group_members`
`shared_expenses`
`settlements`
`user_rules`
`capture_events`
`attachments`
`audit_events`
`notifications`
`outbox_events`
`idempotency_records`

Do not create unnecessary tables.

Use safe migrations and preserve existing data.

---

# 16. AUDITABILITY

Track important changes:

- actor
- timestamp
- before
- after
- source
- reason

For intelligent processing, retain enough metadata to answer:

**“Why did Byjan create/classify this transaction?”**

---

# 17. PROCESSING

Keep financial state separate from processing state.

Financial:

`DRAFT | PENDING | CONFIRMED | VOIDED | REVERSED`

Processing:

`INGESTED | NORMALIZING | VALIDATING | CLASSIFYING | READY | REVIEW_REQUIRED | FAILED | RETRYING | COMPLETED`

Use asynchronous processing for expensive work where appropriate.

Persist transaction first; process enrichment/notification afterward.

---

# 18. TESTING

Add/update tests for:

- transaction calculations
- categories
- parser behavior
- PhonePe/Google Pay/UPI cases
- receipts/OCR
- duplicate detection
- idempotency
- shared expenses
- settlements
- recurring expenses
- budgets
- AI failure
- authorization/IDOR
- uploads
- concurrency
- mobile/share flow
- regression of existing Expense Tracker

Include realistic Indian payment/receipt fixtures.

---

# 19. IMPLEMENTATION METHOD

Do NOT blindly rewrite the application.

Follow:

`Inspect → Plan → Implement → Test → Verify regression → Continue`

For every feature:

1. reuse existing functionality if available
2. make the smallest necessary schema/API change
3. implement backend validation/security
4. implement UI
5. test
6. verify existing features

Do not duplicate business logic unnecessarily.

---

# 20. PRIORITY

Implement in this order:

1. Existing Expense Tracker audit/hardening
2. Transaction/account/category foundation
3. Search/filter/performance
4. Receipt/document capture
5. Mobile share capture
6. UPI/PhonePe/Google Pay parsing
7. Duplicate + evidence fusion
8. Shared expenses + settlements
9. Recurring/subscriptions
10. Budgets + savings goals
11. Intelligent categorization + learning
12. Anomaly/commitment insights
13. Advanced reports
14. Security/performance/accessibility hardening
15. Full regression/E2E testing

If functionality already exists, improve it instead of rebuilding it.

---

# 21. FINAL RULE

Build **Byjan Expense Tracker**, not Books.

The product should feel like:

> “I give Byjan a receipt, payment notification or transaction. Byjan understands it, records it, learns my preferences and explains my spending.”

The main differentiation is:

**minimum manual entry + Indian payment awareness + evidence-linked transactions + shared-expense automation + personal learning + intelligent insights + privacy + speed.**

Start by auditing the repository. Do not make broad changes until the existing Expense Tracker architecture and dependencies are understood.
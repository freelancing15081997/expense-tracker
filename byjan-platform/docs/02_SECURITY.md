# 02 · Security requirements (target: OWASP ASVS 4 Level 2; DPDP Act 2023 aware)

Each line is a requirement with a test or check noted.

## 1. Identity and sessions
- **Sign-in methods.**
  - Firebase ID token exchange (`/auth/firebase/exchange`). Verify the signature against Google's JWKS, plus `aud`, `iss`, `exp` and `auth_time`.
  - Phone or email OTP.
  - Passwords are never handled by this API; Firebase owns them.
- **Access token.** A JWT signed with **EdDSA (Ed25519)**, valid for 10 minutes. Claims: `sub`, `sid`, `amr`, `mfa`, `iat`, `exp`, `jti` and `ver` (the session version). Keys rotate through a `kid`, the JWKS endpoint is internal, and there is always a 2-key overlap.
- **Refresh token.** Opaque, 256-bit random, stored as a SHA-256 hash in `core.sessions`, rotated on every use, and valid for 30 days with a 7-day idle timeout.
  - **Reuse detection:** if an old token is presented, revoke the whole session family and notify the user.
  - The web receives it in an `httpOnly; Secure; SameSite=Strict; Path=/v1/auth` cookie, so only the auth routes ever see it. Android stores it in encrypted secure storage (Capacitor Secure Storage / Keystore).
- **OTP.** 6 digits, valid for 5 minutes, hashed with HMAC. At most 5 attempts, then a 15-minute lock. At most 3 sends per 10 minutes per identifier and 20 per IP per hour. Timing is constant. Responses are generic, so they never reveal whether an account exists.
- **MFA.** TOTP (RFC 6238) plus 10 single-use recovery codes (hashed with argon2id). It is required for Owner and Admin, for the Auditor role flag, for super users and for any role with `require_mfa`.
- **Step-up.** A fresh MFA or OTP within 5 minutes (`amr` plus `auth_time` claims) is required for:
  - deleting a company or account
  - changing roles or permissions, and transferring ownership
  - unlocking or reopening a period
  - filing a tax return
  - adding or changing a bank account or UPI ID
  - payment runs above the role limit
  - exporting all data
  - super-user view-as
  - Dhani rate changes and reversing ledger entries older than 7 days
- **Sessions.** The user can list them and revoke one or all others. Revoke everything on password or MFA reset. The idle timeout per role comes from the role settings (`session_timeout`).
- **CSRF.** The cookie is used only on `/v1/auth/refresh`, protected by `SameSite=Strict` **and** an Origin allowlist check. All other routes use Bearer tokens, so they are not CSRF-prone.

## 2. Tenant isolation (the most important control)
- Every tenant-owned table has `tenant_id UUID NOT NULL` and **Postgres RLS**:
  ```sql
  ALTER TABLE t ENABLE ROW LEVEL SECURITY;
  ALTER TABLE t FORCE ROW LEVEL SECURITY;
  CREATE POLICY p ON t USING (tenant_id = current_setting('app.tenant_id')::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
  ```
- The app DB role is not the table owner and has no `BYPASSRLS`. Migrations run as a separate owner role.
- Repositories **also** filter on `tenant_id` (defence in depth).
- Primary keys are UUIDv7, so IDs can't be enumerated, but visibility is still enforced.
- Another tenant's resource returns **404**, not 403.
- CA access to client books happens only through an explicit membership (`kind='ca'`, granted by the client Owner or Admin, revocable, audited). The UI banner shows it.
- Console (super user) reads use a dedicated `console_ro` role with `BYPASSRLS` on read-only views. Every call is audited with the reason entered.
- **Test:** `tests/tenancy_matrix_test.py` enumerates every route from the OpenAPI schema, creates resources in tenant A and calls the route as tenant B. It expects 404/403 and no data leak. This runs in CI.

## 3. Authorization
- **RBAC.** Every route declares `require(module, action)`. The actions are view, create, edit, delete, approve, post and export. The module keys are the `NAV` / `NAV_CA` item keys, plus the Dhani modules in 04.
  - The matrix follows `permsFor` and `PAPPLY` (non-applicable cells are null).
  - Any action implies view.
  - The Owner role is locked.
  - The effective permissions are cached in Redis per `(tenant, user, perm_version)` and invalidated when roles change.
- **ABAC** (the service layer, in `policies.py`):
  - approval limit (paise) per role, with approvals routed when an amount is over the limit
  - branch or org-unit scope, filtering rows by `org_unit_id`
  - `see_costs`, `see_salaries` and `see_bank_balances` field masks, applied to response models through a masker
  - `can_invite`
  - For Dhani, `see_cost_margin` and `see_money` hide the cost and margin fields and the weaver money figures for Godown staff.
- **Maker-checker.** The creator can't approve their own item (PRs, payment runs, discounts above the threshold, expense claims).
- **View-as** issues a read-only token (`scope=ro`, `act_as_role`) that is valid for 30 minutes and makes every mutating route return 403. It needs step-up and is audited.
- **Period lock.** Any write dated in a locked or closed period returns **423**, unless the Owner reopens the period with a reason.

## 4. Input, output and data
- **Validation.** Pydantic runs in strict mode with `extra='forbid'`.
  - String length caps and regexes for GSTIN (checksum validated), PAN, IFSC, HSN/SAC, phone numbers (E.164 or Indian) and email.
  - Amounts must be ≥ 0 and ≤ 10¹⁴ paise.
  - At most 500 lines per document. Arrays are capped.
- **Output.** Explicit response models only, so no internal fields such as `tenant_id` or hashes leak. Masking is applied per principal.
- **Queries.** SQL is parameterised only through SQLAlchemy Core or ORM; no string-built SQL. Sort and filter fields come from an allowlist.
- **Rendering.** PDF and email templates auto-escape. The PDF renderer can't fetch URLs (a custom `url_fetcher` allows only embedded assets), which prevents SSRF.
- **Encryption at rest.** The DB and bucket are encrypted by the provider. Application-level envelope encryption (AES-256-GCM, with the data key wrapped by KMS) covers the PAN, bank account number, Aadhaar (if ever captured, which is discouraged), weaver phone numbers and TOTP secrets. A **blind index** (HMAC) supports exact-match search on encrypted fields.
- **In transit.** TLS 1.2 or higher, HSTS preload, and `sslmode=verify-full` to Postgres.
- **Logs.** Never log tokens, OTPs, full PAN or bank numbers, or document bodies. The structlog processor redacts known keys.
- **Retention.** Financial records are kept 8 years (Companies Act / GST). "Delete account" anonymises personal data but keeps the books (legal basis recorded). Users can export their data (`/v1/me/export`, async). A consent log is stored.

## 5. Files
- Files upload through a presigned PUT to a **private** bucket under `tenant/<id>/<uuid>`, and the key is never user-controlled.
  - The size limit comes from the purpose (10 MB for documents, 5 MB for photos).
  - The MIME type is sniffed with `python-magic` against the allowlist (pdf, jpg, png, webp, heic, csv, xlsx).
  - EXIF data is stripped from photos.
- `POST /files/{id}/complete` verifies the SHA-256 and size, then queues a **ClamAV** scan. The file can't be used until `status=clean`.
- Downloads use presigned GET URLs valid for 60 s, with `Content-Disposition: attachment` for anything that isn't an image.

## 6. Abuse and availability
| Scope | Limit |
|---|---|
| Authentication routes | 10/min per IP |
| Tenant-scoped reads | 600/min per user |
| Tenant-scoped writes | 120/min per user |
| Exports | 10/h per tenant |
| Public catalogue | 60/min per IP |

- Every limit returns 429 with `Retry-After`.
- Request bodies are capped at 1 MB. Timeouts are enforced. Pagination caps apply.
- `Idempotency-Key` is required on money-moving POSTs (payments, receipts, sales, weaver money, payment runs). Keys are stored for 24 h and scoped to the tenant and user.

## 7. Webhooks and integrations
- **Inbound.** An HMAC-SHA256 signature over `timestamp.body` with the provider secret, a tolerance of 5 minutes or less, replay protection through the event-ID store, and an IP allowlist where the provider publishes one.
- **Outbound calls** go to allowlisted hosts only. The default HTTP client blocks private IP ranges (SSRF).
- Integration credentials (GSP, bank, WhatsApp, Tally) are encrypted in `core.integration_secrets` and never returned by the API (only `connected: true`).

## 8. Audit and monitoring
- `core.audit_log` is append-only (INSERT only; `REVOKE UPDATE, DELETE` from the app role).
  - It records actor, tenant, action, entity, before and after (a diff with sensitive fields masked), IP, user agent, request ID and timestamp.
  - **Hash-chained:** `hash = sha256(prev_hash || row)`, and a daily job verifies the chain.
- Security events trigger alerts: login from a new device (with an email/WhatsApp notice), refresh reuse, MFA disabled, a role escalated, an export of everything, view-as used, a burst of 5xx or 401s.

## 9. Supply chain and CI
- CI runs `pip-audit`, `bandit`, `semgrep` (the p/python and p/owasp-top-ten rule sets), `gitleaks` and a `trivy` image scan. A high or critical finding fails the build.
- Dependencies are pinned in `uv.lock`, with Renovate running weekly.
- The container runs as non-root on a read-only filesystem, and secrets are injected at runtime (never baked into the image).

## 10. Security headers (on API responses)
`Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store` on authenticated responses, `Content-Security-Policy: default-src 'none'`, and `Cross-Origin-Resource-Policy: same-site`. CORS is an explicit allowlist (web app origins and `capacitor://localhost` / `https://localhost` for Android). Credentials are allowed only for the auth routes.

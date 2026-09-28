# Byjan Business Backend - Architectural Decisions

**Phase:** 0 - Planning
**Date:** 2026-09-28
**Scope:** Byjan Business + CA Practice + Super-User Console (Dhani excluded per user request)

---

## 1. Monorepo Structure

### Decision
Use `byjan-platform` as the parent directory to avoid conflicts with existing `services/` directory.

### Rationale
- Existing repo has `services/document-parser/` 
- User requested separate parent package with sub-packages for frontend and backend
- Keeps Python backend completely separate from existing Node.js API (mobile Money app)

### Structure
```
byjan-platform/
├── apps/
│   ├── frontend/          # React 19 + Vite (from design brief)
│   └── backend/           # Python FastAPI
├── docs/
├── docker-compose.yml
└── README.md
```

---

## 2. Deployment Platform

### Decision
- **Frontend:** Cloudflare Pages (free tier, unlimited bandwidth, auto-scales)
- **Backend:** Render Web Service (free tier 750h/month, auto-scales on paid upgrade)
- **Database:** Neon Postgres (free tier 0.5GB, serverless)
- **Cache:** Redis Cloud (free tier 30MB)
- **Files:** Cloudflare R2 (free tier 10GB)
- **Custom Domain:** easypado.com (GoDaddy)

### Rationale
- User has free tier constraints
- User has existing GoDaddy domain
- Render auto-scales when upgraded (no code changes needed)
- Cloudflare Pages is static hosting (always fast, no cold starts)
- Neon and Redis Cloud have generous free tiers for testing

### Domain Mapping
- `business.easypado.com` → Cloudflare Pages (frontend)
- `api.easypado.com` → Render (backend)

---

## 3. Integration Strategy

### Decision
Implement **mock adapters** for all external integrations that log warnings when API keys are missing.

### Rationale
- User is on free tiers, may not have paid API keys immediately
- Spec requires future-ready architecture for easy replacement
- Mock adapters allow full testing without paid services
- Warning logs in Trace Console alert user to add keys

### Adapters to Mock
- WhatsApp Business API
- GSP (GST filing)
- Account Aggregator / Bank feeds
- UPI payment links
- Tally connector
- OCR/LLM bill reading

### Implementation Pattern
```python
class MessageGateway(Protocol):
    async def send(self, to: str, template: str, **kwargs) -> Result[str, Error]

class RealWhatsAppGateway(MessageGateway):
    async def send(self, to: str, template: str, **kwargs):
        if not settings.WHATSAPP_API_KEY:
            await log_critical("WhatsApp API key missing", integration="whatsapp")
            return Err(Error("API key missing"))
        # Real implementation...

class MockWhatsAppGateway(MessageGateway):
    async def send(self, to: str, template: str, **kwargs):
        await log_warning("WhatsApp using mock adapter", integration="whatsapp")
        return Ok("mock_sent")
```

---

## 4. Existing Node.js API

### Decision
**Do not modify** the existing `/api` Node.js functions or their tables.

### Rationale
- Spec explicitly states this constraint
- Node API handles mobile Money app (out of scope for this project)
- Python backend uses separate Postgres schemas (`core`, `biz`, `ca`)
- Frontend will switch between Node and Python APIs via feature flags

### Schema Separation
- Existing Node API: Uses existing tables
- Python Backend: Uses new schemas (`core`, `biz`, `ca`)
- Frontend: Uses `VITE_API_URL` to switch between them

---

## 5. Authentication Strategy

### Decision
Use Firebase ID token exchange as primary auth method, with OTP as fallback.

### Rationale
- Spec requires Firebase integration
- Existing Node API already uses Firebase
- User already has Firebase project (inferred from existing repo)
- OTP backup for users without Firebase

### Implementation
- JWT access tokens (EdDSA Ed25519, 10 min validity)
- Opaque refresh tokens (SHA-256 hashed, 30 days)
- MFA (TOTP) for Owner, Admin, Auditor roles
- Step-up authentication for sensitive operations

---

## 6. Comprehensive Logging/Tracing System

### Decision
Build a **Trace Console** at `/v1/console/traces` that tracks all system events, integration health, and errors.

### Rationale
- User explicitly requested: "one feature or ui to findout whatever the issues are logs for all things happening"
- Need to detect missing API keys, service failures, and all system events
- Must be searchable with filters (time, module, severity, integration, etc.)
- Critical for free-tier debugging

### Features
- Real-time event stream (CRITICAL, WARNING, INFO, DEBUG)
- Integration health dashboard (Firebase, WhatsApp, GSP, Neon, Redis, etc.)
- Searchable filters (time range, module, severity, integration, user, action)
- Automatic alerts for missing API keys, service failures, rate limits
- Export logs (CSV, JSON, PDF)
- Trace timeline across logs, audit, and jobs

### Integration Health Checks
- Firebase Auth (API key, project ID)
- WhatsApp API (API key, phone number ID)
- GSP (API credentials, connection status)
- Neon Database (connection, query performance)
- Redis Cache (memory usage, connection)
- Cloudflare R2 (access key, bucket)
- Email (Resend/SES API key)
- Sentry (DSN configuration)

---

## 7. Database Schema Design

### Decision
Use 4 separate Postgres schemas: `core`, `biz`, `ca`, `console`.

### Rationale
- Spec requires this separation
- Logical module boundaries
- Easy to backup/restore per module
- RLS policies enforced per schema

### Schema Breakdown
- **core:** Users, sessions, tenants, members, invites, roles, permissions, files, notifications, audit_log, outbox, change_log, idempotency, undo_tokens, jobs, number_series, integration_secrets, webhook_events, console_issues, consents
- **biz:** Chart of accounts, GL entries, periods, parties, items, stock, documents, payments, bank, assets, projects, budgets, tax returns, compliance, queries, approvals, imports, org_units
- **ca:** Clients, compliance items, tasks, review items, team, time entries
- **console:** Read-only views for super-user operations

---

## 8. Document Engine Architecture

### Decision
Use a **single document engine** with a DocType registry for all 14 document types.

### Rationale
- Spec explicitly requires this (Rule #2: "The 14 business document types share one document engine")
- Avoids code duplication
- Adding new document types is just a registration
- State machine, posting rules, numbering are centralized

### Document Types
1. invoices
2. estimates
3. quotes
4. sales-orders
5. credit-notes
6. debit-notes
7. purchase-requests
8. purchase-orders
9. purchase-receipts
10. bills
11. vendor-credits
12. journals
13. recurring
14. expenses

### Registry Pattern
```python
class DocTypeSpec:
    name: str
    prefix: str
    party_kind: Optional[Literal['customer', 'supplier']]
    statuses: List[str]
    transitions: Dict[str, TransitionSpec]
    posting_rule: Callable
    numbering_series: str
    editable_fields: Dict[str, List[str]]

DOCTYPE_REGISTRY: Dict[str, DocTypeSpec] = {}
```

---

## 9. Money Handling

### Decision
All money values stored as **integer paise** (BIGINT). No floats.

### Rationale
- Spec explicitly requires this (Rule #5)
- Avoids floating-point precision errors
- GST calculations require exact rounding
- Standard Indian accounting practice

### Rounding Rules
- Tax per line: `round_half_up(taxable_line × rate)`
- CGST = floor(tax/2), SGST = tax - CGST
- Document round-off: to nearest rupee
- Posted to "Round-off" account

---

## 10. Idempotency and Undo

### Decision
All mutations are idempotent and return `undo_token` where reversible.

### Rationale
- Spec requires this (Rule #6)
- Prevents duplicate submissions
- User can undo mistakes
- Critical for accounting accuracy

### Implementation
- `Idempotency-Key` header for POST operations
- Redis lock per tenant/user/key
- Response replay from stored result
- `undo_token` valid for 24h or until dependent change
- Undo through registered reverse use case

---

## 11. Concurrency Control

### Decision
Use `If-Match` with resource version for optimistic concurrency, row locks for stock/balances.

### Rationale
- Spec requires this (Rule #7)
- Prevents lost updates
- Ensures data integrity
- 412 Precondition Failed on stale version

### Implementation
- Every resource has `version` field (integer)
- Client sends `If-Match: <version>` header
- Server checks version before update
- Stock, godown tags, balances use `SELECT ... FOR UPDATE`
- Single-statement conditional updates as alternative

---

## 12. Pagination Strategy

### Decision
Use **cursor-based (keyset) pagination** for all lists.

### Rationale
- Spec requires this (Rule #8)
- More efficient than offset pagination
- Consistent results during inserts
- No N+1 queries (enforced by tests)

### Implementation
- Default `limit: 25`, max `limit: 100`
- Cursor: `(tenant_id, sort_col, id)`
- Response: `{data, page: {next_cursor, has_more}, meta}`
- Count queries only when UI shows total

---

## 13. Testing Strategy

### Decision
Test pyramid with unit, service, API, security, contract, concurrency, and load tests.

### Rationale
- Spec requires comprehensive testing (06 §1)
- User explicitly requested: "test end to end without faking anything"
- Must validate all 305 endpoints
- Security is critical (financial data)

### Coverage Gates
- 90% coverage on `domain/` and `application/`
- 80% overall coverage
- All endpoints in COVERAGE.md must have tests
- Tenancy matrix test (every route × other tenant)
- Permission matrix test (every route × missing permission)
- Schemathesis (OpenAPI fuzz testing)

### Free-Tier Adaptations
- Load testing with reduced dataset (50 weavers instead of 5,000)
- Real services (Neon, Redis, Firebase) - no mocks for core
- Mock adapters only for external integrations (WhatsApp, GSP)

---

## 14. CI/CD Pipeline

### Decision
GitHub Actions with strict gates before merge.

### Rationale
- Spec requires this (06 §2)
- Ensures code quality
- Prevents breaking changes
- Automated security scanning

### Pipeline Steps
1. `uv sync --frozen`
2. `ruff check` + `ruff format --check`
3. `mypy --strict app`
4. `bandit -r app`, `semgrep`, `pip-audit`, `gitleaks`
5. `alembic upgrade head`, `downgrade -1`, `upgrade`
6. `pytest -n auto --cov`
7. Schemathesis (5 minutes)
8. OpenAPI diff, regenerate TypeScript clients
9. Docker build, `trivy` scan
10. Deploy to staging, run smoke tests

---

## 15. Dhani Exclusion

### Decision
**Dhani Khatha is completely excluded** from this implementation.

### Rationale
- User explicitly stated: "dont consider dhani requiremnts now at all i need only byjan business"
- Reduces scope from 365 to 305 endpoints
- Focus on Business + CA + Console

### Excluded Endpoints
- All D1-D67 endpoints from spec 04
- Dhani-specific schemas, tables, domain logic
- Offline sync, weaver management, yarn tracking

---

## 16. Frontend Integration

### Decision
Use the provided React 19 + Vite frontend from design brief.

### Rationale
- User provided complete frontend code in `Mobile App UX Design Brief (5).zip`
- Spec references this frontend
- High-fidelity design already implemented
- Need to wire it to Python backend

### Integration Approach
- Replace `BizLogic.js` mock data with API calls
- Use `VITE_API_URL` environment variable
- Feature flags to switch between mock and real API
- Generate TypeScript client from OpenAPI spec

---

## 17. Performance Targets

### Decision
Adapted SLOs for free-tier constraints.

### Rationale
- Spec requires specific SLOs (01 §7)
- Free tiers have limitations (cold starts)
- Adapt targets while maintaining usability

### Targets
- Read latency p95: < 200ms (adjusted from 150ms for cold starts)
- Write latency p95: < 400ms (adjusted from 300ms)
- Dashboard p95: < 1s (adjusted from 800ms)
- Outbox lag: < 30s
- Job failure rate: < 1%

### Scaling Path
- Upgrade to paid Render tier for always-running backend
- Add CDN caching for static assets
- Database read replicas for heavy reports

---

## 18. Security Headers

### Decision
Implement all OWASP ASVS Level 2 headers per spec 02 §10.

### Rationale
- Spec requires this
- User handling financial data
- Mandatory for production

### Headers
- `Strict-Transport-Security`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- `Cache-Control: no-store` on authenticated responses
- `Content-Security-Policy: default-src 'none'`
- `Cross-Origin-Resource-Policy: same-site`
- CORS explicit allowlist (easypado.com, capacitor://localhost)

---

## 19. Tenant Isolation

### Decision
Defense in depth: Postgres RLS + repository filters + 404 for other tenants.

### Rationale
- Spec requires this (02 §2 - "the most important control")
- Financial data isolation is critical
- Prevents data leaks

### Implementation
- Every tenant table has `tenant_id` column
- Postgres RLS enabled and forced
- Repository layer also filters by `tenant_id`
- Other tenant's resources return 404, not 403
- Generated test proves isolation

---

## 20. Audit Trail

### Decision
Append-only audit log with hash chain verification.

### Rationale
- Spec requires this (02 §8)
- Financial regulations require audit trails
- Detects tampering

### Implementation
- `core.audit_log` is INSERT only (REVOKE UPDATE, DELETE)
- Records actor, tenant, action, entity, before/after diff, IP, UA, request ID
- Hash-chained: `hash = sha256(prev_hash || row)`
- Daily job verifies chain integrity
- Security events trigger alerts

---

## Open Questions / Future Decisions

1. **Database Migration Strategy:** How to migrate existing Node API data to Python schemas? (Deferred - not in initial scope)
2. **Feature Flag Rollout:** Should we use Firebase Remote Config or internal flags? (Decision deferred to Phase 2)
3. **WhatsApp Sandbox:** Use Meta's free sandbox or mock from day one? (Decision: Mock with warning logs)
4. **GSP Provider:** Which GSP provider for GST filing? (Decision: Mock adapter, user can configure later)
5. **Email Provider:** Resend or AWS SES? (Decision: Resend for free tier, easy to switch)

---

## Decision Log Format

All future decisions will be added to this document with:
- Date
- Decision summary
- Rationale
- Alternatives considered
- Impact assessment

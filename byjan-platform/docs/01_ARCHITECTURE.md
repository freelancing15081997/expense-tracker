# 01 · Architecture

## 1. Stack (fixed; do not substitute)
| Concern | Choice |
|---|---|
| Language | Python 3.12, fully typed (`mypy --strict`) |
| Web | FastAPI + Uvicorn workers under Gunicorn, `orjson` responses |
| Validation | Pydantic v2 in strict mode; separate request and response models (no ORM objects leak out) |
| DB | PostgreSQL 16 (Neon in production, through its pooled endpoint) with SQLAlchemy 2.0 async + asyncpg, and Alembic |
| Cache, locks, rate limits | Redis 7 |
| Background jobs | Arq (async, Redis) fed by a **transactional outbox** |
| Files | S3-compatible private bucket (R2/S3/MinIO) with presigned URLs; ClamAV scan |
| PDF | WeasyPrint with Jinja2 templates, per language (Noto Sans Telugu/Tamil/Kannada/Devanagari fonts embedded) |
| Messaging | Email (SES/Resend), WhatsApp Business Cloud API and SMS behind one `MessageGateway` port |
| External | GSP (GST filing, e-invoice, e-way bill, GSTR-2B), Account Aggregator / bank feeds, UPI payment links, Tally connector, and OCR/LLM bill reading. Each sits behind a port with a fake adapter for tests |
| Observability | structlog JSON, OpenTelemetry traces and metrics (OTLP), Sentry, Prometheus `/metrics` (internal only) |
| Packaging | `uv` for dependencies and lockfile; Docker multi-stage image, distroless or slim, non-root |

Deploy it as a long-running container (Cloud Run, Fly, ECS or Render), **not** as serverless functions. The web and mobile apps call it through `VITE_API_URL`.

## 2. Bounded contexts (modules)
```
platform   identity, tenancy, rbac, audit, files, notifications, messaging, search, jobs, undo, webhooks, flags
business   ledger (COA, GL, periods), parties, items, tax, documents, payments, bank, stock, assets,
           projects, budgets, forecast, deals, leases, inbox, approvals, imports, org, reports, dashboards
ca         clients, compliance, tasks, review, doc_requests, time, billing   (queries are shared: business.queries)
console    super-user operations (reads across tenants through dedicated, audited repositories)
dhani      masters, rates, designs, setups, weavers, assignments, pieces, yarn, weaver_money, receipts,
           godown, sales, parties, khatha, demand, catalogues, home, reports, sync
shared     kernel: Money, Qty, Percent, ids (UUIDv7), Clock, Result, errors, pagination, i18n
```
- Modules talk only through **application service interfaces** (for synchronous queries) or **domain events** (for reactions).
- Example: `dhani.sales` emits `SaleCompleted`, and `dhani.khatha` consumes it to write the Jama entry in the same unit of work (a synchronous in-process handler).
- Notifications are asynchronous and go through the outbox.

## 3. Layering inside each module
```
services/api/app/<context>/<module>/
  api.py            FastAPI router: parse → call service → map to response. No business logic.
  schemas.py        Pydantic request/response DTOs (+ OpenAPI examples)
  service.py        Application service / use cases; owns the transaction via UnitOfWork
  domain/
    models.py       Entities & value objects (dataclasses, no SQLAlchemy)
    rules.py        Pure calculations & invariants (GST, kooli, yarn balance, state machines)
    events.py       Domain events (frozen dataclasses)
    policies.py     Authorization/ABAC predicates (pure)
  ports.py          Protocols: Repository, Gateway interfaces this module needs
  infra/
    orm.py          SQLAlchemy tables/mappers
    repo.py         Repository implementation (tenant-filtered, keyset pagination)
    gateways.py     Adapters to external systems
  tests/            unit (domain), service (fake repos), api (httpx + testcontainers)
```

### How SOLID applies here
- **S:** a router only handles HTTP, a service only runs one use case, and a repository only persists. Calculations live in `rules.py`.
- **O:** new document types, report types, master kinds, weaver money kinds, bank-match rules and compliance rules are **registrations** (a spec class plus an entry in the registry). Adding one never edits a switch statement.
- **L:** every `DocTypeSpec` honours the same contract: `transitions`, `posting_rule`, `numbering` and `editable_fields`. Every `MessageGateway` adapter is interchangeable.
- **I:** ports are small, for example `PartyReader` versus `PartyWriter`, and `Clock`, `IdGen`, `FileStore` and `PdfRenderer` are separate.
- **D:** services depend on `Protocol`s, and the composition root (`app/main.py` and `deps.py`) wires the concrete adapters. Tests inject fakes.

## 4. Cross-cutting request pipeline (in order)
1. Request ID and trace context (`X-Request-Id`, which is echoed back)
2. Security headers, CORS allowlist and body-size limit (1 MB JSON; files go direct to S3)
3. Rate limit (Redis token bucket per IP + user + tenant + route class)
4. Authentication. Bearer access JWT, or an httpOnly cookie on the web, is verified with a cached JWKS and yields a `Principal`.
5. Tenant resolution: the `X-Tenant-Id` header is checked for active membership, and the transaction runs `SET LOCAL app.tenant_id = …` and `SET LOCAL app.user_id = …` (RLS).
6. Authorization dependency `require("module", "action")`, then ABAC policies inside the service (limits, branch scope, field masks)
7. Idempotency (for POST, and for PATCH when the header is present). The Redis lock and the `core.idempotency_keys` row replay the stored response.
8. Handler → service → UnitOfWork: domain rules, repositories, audit, outbox, then commit
9. Response: ETag from `version`; field masking by ABAC; `orjson`

## 5. API conventions (apply to every endpoint)
- **Base path:** `/v1`. JSON uses snake_case, dates are ISO 8601 (`YYYY-MM-DD`), timestamps are RFC 3339 UTC, and IDs are UUIDv7 strings.
- **Tenant:** send `X-Tenant-Id` on every tenant-scoped route. Public routes (`/v1/public/*`, `/v1/auth/*`, `/v1/webhooks/*`, `/v1/invites/peek|accept|decline`) take no tenant header.
- **Money:** `{"amount": 123450}` in paise, and every money field ends in `_paise`. **Qty:** yarn is `_mg` (milligrams), length is `_mm`, and counts are integers.
- **Lists:** `?limit=25&cursor=…&sort=field,-field&q=…&<filter>=…`. The response is `{"data":[…],"page":{"next_cursor":…,"has_more":bool},"meta":{…}}`. Add `?include_total=true` only where the UI shows a count; totals come from a count query, or from a cached projection for large sets.
- **Counts for tabs:** use `GET …/counts` and group in one query. Never fetch the whole list to count it.
- **Sparse fieldsets and expansion:** `?fields=` and `?expand=party,lines`, from an allowlist per resource.
- **Actions:** use `POST /resource/{id}/actions/{action}` for state transitions. Use `PATCH` only for plain field edits.
- **Errors:** RFC 9457 `application/problem+json` with `type`, `title`, `status`, `code`, `detail`, `errors[] {field, code, message}` and `trace_id`. `code` values are stable and listed in 03 §0.
- **Status codes:**
  - 200 read or update; 201 create (with `Location`); 202 async job; 204 delete
  - 400 bad request; 401 not signed in; 403 not allowed; 404 not found, or not visible to this tenant (never 403 for another tenant's resource)
  - 409 state conflict; 412 version mismatch; 413 payload too large; 422 validation; 423 period locked; 428 `If-Match` required; 429 rate limited
- **Undo:** reversible mutations return `undo_token`, which is valid for 24 h or until a later dependent change. `POST /v1/undo/{token}` runs the registered reverse use case, and that is audited too.
- **Async:** long work (reports over 2 s, exports, imports, filing, bulk actions over 50 items) returns `202 {job_id}`, then `GET /v1/jobs/{id}`, with a notification when it finishes.
- **Versioning:** you may add fields; removing or renaming one needs `/v2`. Deprecated fields get a `Deprecation` header.

## 6. Key patterns
- **UnitOfWork.** One DB transaction per use case. Repositories, the audit writer and the outbox writer share it. A commit publishes in-process event handlers first, and then the outbox rows are picked up by the worker.
- **Transactional outbox.** `core.outbox(id, tenant_id, type, payload, created_at, published_at, attempts)`. The worker polls with `FOR UPDATE SKIP LOCKED` and dispatches to handlers (notifications, email/WhatsApp, search indexing, projections, webhooks out). Handlers are idempotent on `event_id`.
- **Double-entry ledger (Business).** Every posted document calls its `PostingRule`, which produces balanced `gl_entries`. The DB enforces Σdr = Σcr per journal with a deferred constraint trigger. Balances come from `gl_balances` (account × period), maintained in the same transaction. Reversal means a mirror entry, never a delete.
- **Document engine (Business).** `DocTypeRegistry[type]` holds the statuses, the `transitions: {action: (from_states, to_state, guard, effect)}`, the numbering series, the party kind, the posting rule and the editable fields per status. All 14 types (`invoices, estimates, quotes, sales-orders, credit-notes, debit-notes, purchase-requests, purchase-orders, purchase-receipts, bills, vendor-credits, journals, recurring, expenses`) are specs. Port `verbs()` / `verb()` from `BizLogic.js` into these transition tables.
- **Append-only sub-ledgers (Dhani).**
  - `weaver_money` entries use the kinds earned / paid / advance / recover / cut / adjust.
  - `yarn_moves` use the directions give / return / consume / adjust.
  - `ledger` entries are either Jama (in) or Kharchu (out).
  - Balances are **projections** (`dhani.weaver_stats`), updated in the same transaction and rebuildable by a job (`rebuild_projections`). Nothing is ever updated in place or deleted. Corrections are reversal entries.
- **Numbering series.** Each tenant has a gap-free series per `(doc_type, fy, entity)`, implemented as `UPDATE series SET next = next + 1 … RETURNING` inside the transaction. Dhani godown tags use `S-0001`, sale bills use `B-0001`, and designs use `DKS-1001`.
- **Projections for scale.** These are kept current transactionally, and nightly jobs verify them against the source tables:
  - `dhani.weaver_stats`: done, total, pending, next ETA, late, kooli due, advance out, net, yarn held and status
  - `biz.party_balances`
  - `biz.stock_levels`
  - `dashboard_tiles`, which are cached in Redis for 60 s and invalidated by events
- **Search.** Postgres full-text search (`tsvector` with the `simple` configuration, which works for Indic scripts) plus a `pg_trgm` trigram index on names, codes, tags, GSTIN and phone numbers. The search service fans out across resource types, and every query is tenant-scoped.
- **Rules engines (pure, registry-based).**
  - bank auto-match rules
  - CA review rules (GSTR-2B missing, uncategorised, cash over ₹10,000 under 40A(3), duplicate, wrong GST/RCM, import of service, blocked credit under 17(5))
  - the compliance calendar generator
  - watch-list alerts
  - Dhani smart tips (late weavers, colours in demand, free looms, kooli due)
- **Offline sync (Dhani).** The client queues operations with `client_op_id` and a base `version`. `POST /sync/push` applies them in order and idempotently, with per-op results (`ok | conflict | rejected`). `GET /sync/pull?since=` returns a change feed from `core.change_log`, using per-tenant sequence numbers.

## 7. Performance and scale targets
- **Latency:** p95 under 150 ms for reads, under 300 ms for writes, and under 800 ms for dashboards (cached), at 200 RPS per instance. Scale horizontally; the app is stateless.
- **Indexes:** every list filter has a composite index that starts with `tenant_id`. Keyset pagination uses `(tenant_id, sort_col, id)`.
- **Partitioning:** partition `core.audit_log`, `core.change_log`, `biz.gl_entries`, `dhani.ledger`, `dhani.weaver_money` and `dhani.yarn_moves` by month (range, with pg_partman).
- **No N+1:** a test fixture asserts the number of queries per endpoint (at most 6 for lists).
- **Connections:** asyncpg pool of 10 per worker through the Neon pooler, with `statement_timeout` 5 s for APIs and 120 s for jobs.
- **Reports:** heavy reports read from a replica (`DB_READ_URL`) when one is configured. Outputs are cached per `(tenant, report, params, data_version)`.
- **Payloads:** gzip or brotli at 1 KB and above. Images never pass through the API; they use presigned PUT and GET.
- **Resilience:** external calls have timeouts (3 s connect, 10 s read), retries with jitter for idempotent calls only, and circuit breakers. GSP and bank failures create a `console.issue`.

## 8. Repository layout
```
services/api/
  pyproject.toml  uv.lock  Dockerfile  docker-compose.yml  alembic.ini  .env.example
  app/
    main.py  deps.py  settings.py  middleware/  errors.py  pagination.py
    shared/  platform/  business/  ca/  console/  dhani/
    workers/ (arq settings, outbox dispatcher, schedulers)
    templates/ (pdf/email/whatsapp per lang: en, te, ta, kn, hi)
  migrations/versions/
  tests/ (conftest with testcontainers, factories, tenancy_matrix_test.py, schemathesis)
  docs/ COVERAGE.md DECISIONS.md EVENTS.md RUNBOOKS.md
```

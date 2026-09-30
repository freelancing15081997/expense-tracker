# 06 · Quality, operations and delivery

## 1. Test pyramid
| Layer | Tooling | What must be covered |
|---|---|---|
| Domain unit | pytest, **hypothesis** | GST `calc()` parity with the JS version (a golden fixture exported from `constants.js`); CGST+SGST = tax; round-off within ±₹0.50; journals balance; state-machine transitions for all 14 DocTypes; Dhani `wStats`, `costOf`, `priceOf`, receive and assign maths; yarn balance never negative; ETA planning with hold and resume |
| Service | pytest-asyncio, fake repos and gateways | Each use case's happy path and every error code it can raise; idempotent replay; `undo_token` round trip; events emitted |
| API / integration | httpx AsyncClient, **testcontainers** (Postgres 16, Redis), MinIO | Every endpoint in `COVERAGE.md`; RLS on; query-count fixture (≤ 6 per list); pagination stable under inserts; `If-Match` 412; 423 locked period |
| Security | generated `tenancy_matrix_test.py`, `permission_matrix_test.py` | Every route × {other tenant, missing permission, read-only view-as token, no auth} gives 404/403/401; step-up routes without elevation give 401 `auth.step_up_required` |
| Contract | **schemathesis** (OpenAPI fuzz); `openapi-diff` against `main` | No 5xx; no breaking change without `/v2` |
| Concurrency | pytest with parallel tasks | Two sales on one tag (exactly one succeeds); two receipts on one piece; paying kooli twice with the same key (one row); number series under 50 concurrent creates (no gaps or duplicates) |
| Load | **k6** | The SLOs below on a seeded tenant: 5,000 weavers, 200k pieces, 1M ledger rows; Business: 100k docs |
| E2E smoke | Playwright against the web app, and the Android build on an emulator | Sign in → create invoice → pay → reconcile; Dhani: design → setup → assign → receive → sell → khatha shows it |

**Coverage gates:**
- 90 % on `domain/` and `application/`, and 80 % overall.
- Mutation testing (`mutmut`) runs weekly on `rules.py` files and must score at least 70 %.

## 2. CI pipeline (GitHub Actions); a PR can't merge unless every step is green
1. `uv sync --frozen`
2. `ruff check` + `ruff format --check`
3. `mypy --strict app`
4. `bandit -r app`, `semgrep`, `pip-audit`, `gitleaks`
5. `alembic upgrade head`, then `alembic downgrade -1`, then `upgrade` again, on a fresh database
6. `pytest -n auto --cov` (unit, service and API tests, with the tenancy and permission matrices)
7. Schemathesis (5 minutes, stateful)
8. OpenAPI diff, and regenerate the TypeScript clients to check they compile (`tsc --noEmit` in both front ends)
9. Docker build, then a `trivy` scan
10. On `main`: deploy to staging, run the smoke tests, then promote to production manually (blue/green)

## 3. SLOs and alerts
| SLI | Target | Alert |
|---|---|---|
| Availability (non-5xx) | 99.9 % monthly | burn rate over 2 % per hour |
| Read latency p95 | < 150 ms | > 300 ms for 10 minutes |
| Write latency p95 | < 300 ms | > 600 ms for 10 minutes |
| Dashboard or home p95 | < 800 ms | > 1.5 s |
| Outbox lag | < 30 s | > 2 minutes |
| Job failure rate | < 1 % | any failed filing or payment-run job |
| Projection drift | 0 | any drift |

Dashboards cover RED metrics per route, DB pool and slow queries (`pg_stat_statements`), Redis, queue depth, external gateway error rates and security events.

## 4. Environments and configuration
- **Environments:** `local` (docker-compose), `staging` and `production`, with separate databases, buckets, keys and Firebase projects.
- **Settings** are loaded with `pydantic-settings` from the environment, and every one is listed in `.env.example`: `DATABASE_URL`, `DB_READ_URL`, `REDIS_URL`, `S3_*`, `JWT_PRIVATE_KEYS`, `KMS_KEY_ID`, `FIREBASE_PROJECT_ID`, `GSP_*`, `WHATSAPP_*`, `EMAIL_*`, `SENTRY_DSN`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `CORS_ORIGINS` and `CONSOLE_IP_ALLOWLIST`.
- **Secrets** live in the platform secret manager, never in the repo or the image.
- **Database:** Neon with PITR (7 days on staging, 30 days on production), a nightly logical dump to a separate account, and a monthly **restore drill** that is written up in `RUNBOOKS.md`.

## 5. Scheduled jobs (Arq cron)
| Job | Schedule |
|---|---|
| Outbox dispatcher | continuous |
| Recurring documents | 06:00 IST |
| Payment reminders | 10:00 IST |
| Bank feeds | hourly |
| GSTR-2B download | the 14th of each month |
| Compliance generator | the 1st of each month |
| Watch-list and tips evaluation | every 15 minutes |
| Late-weaver notifications | 08:00 IST |
| Projection verification | 02:00 |
| Audit hash-chain verification | 03:00 |
| Partition maintenance | monthly |
| Idempotency and undo cleanup | hourly |
| File orphan cleanup | daily |
| Session cleanup | daily |

## 6. Delivery checklist (Definition of Done per endpoint)
- [ ] It is in OpenAPI with examples, the permission declared, and the error codes listed.
- [ ] Router, service, domain and repository are separated, and the service depends on ports only.
- [ ] Pydantic request and response models (`extra='forbid'`).
- [ ] RLS table, plus a repository tenant filter and an index for every filter and sort.
- [ ] Audit row, outbox event, idempotency, `If-Match`, and `undo_token` where it can be reversed.
- [ ] Unit, service and API tests, plus coverage in the tenancy and permission matrices.
- [ ] The row in `COVERAGE.md` is updated.

## 7. Front-end cut-over (strangler)
- Generate the clients: `npx openapi-typescript $API/openapi.json -o src/api/schema.d.ts`, plus a thin fetch wrapper that adds the auth, `X-Tenant-Id`, `Idempotency-Key` (UUID per user action) and `If-Match` headers.
- **Byjan Business:** swap each `useMock(domain)` for its real hook one at a time, in this order: me/RBAC → parties/items → documents → payments → bank → ops → tax → CA → console.
- **Dhani:** replace `seed()` in `DhaniLogic.js` with `GET /dhani/bootstrap` plus paged lists. Map each action to its endpoint:

| Front-end action | Endpoint |
|---|---|
| `doReceive` | `POST /receipts` |
| `doAssign` | `POST /assignments` |
| `payKooli`, `cutAdv`, `advBack`, `giveAdv` | `POST /weavers/{id}/money` (with the right `kind`) |
| `takeBack` | `POST /weavers/{id}/yarn` `{dir: return}` |
| `toggleHold` | `actions/hold\|resume` |
| `moveRemaining` | `actions/move-remaining` |
| `saveEd` | `POST\|PATCH /designs` |
| setup save | `POST /setups` |
| sheet sell / reserve | `POST /sales` / `actions/reserve` |

  - Day offsets (`d`, `eta`) become ISO dates.
  - Put the offline queue in IndexedDB, flushed through `/sync/push`.
- Put a feature flag on each domain so it can switch back to mock mode instantly.

## 8. Runbooks (`docs/RUNBOOKS.md`)
Write one for each of these:
- GSP down
- Bank token expired
- Outbox backlog
- Projection drift (run `rebuild_projections --tenant`)
- Audit chain break
- Key rotation (JWT, KMS)
- Leaked refresh token (revoke the family)
- A tenant data-export request
- Restore to a point in time
- Maintenance mode (`platform_flags.maint`)

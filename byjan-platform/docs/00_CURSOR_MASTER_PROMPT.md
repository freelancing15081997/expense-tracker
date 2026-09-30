# Cursor master prompt — Byjan Python backend (Business + CA + Dhani Khatha)

Put the whole `backend_handoff/` folder at the repo root, open Cursor in **Agent mode**, and paste everything below the line. Cursor must read the other six files before it writes any code.

---

You are a principal backend engineer. Build the **production Python backend** for two products that share one platform:

1. **Byjan Business**: company books with Business and CA-practice workspaces. The front end is in `byjan-business-web/` and the spec is `design_handoff_byjan_web/README.md`.
2. **Byjan Dhani (Dhani Khatha)**: a saree business app for handloom master weavers (a "Dhani"). The flow is design → setup (lot) → give to weaver → receive with QC → godown → sell, and a khatha tracks every rupee and every gram of yarn. The front end is in `dhani-khatha-app/`, and its logic is in `src/logic/DhaniLogic.js`.

The specification is in these files. They are binding, so read all of them first:
- `backend_handoff/01_ARCHITECTURE.md`: stack, layering, SOLID rules, folder layout, patterns, performance.
- `backend_handoff/02_SECURITY.md`: security controls. Each one is a requirement.
- `backend_handoff/03_API_PLATFORM_AND_BUSINESS.md`: every platform, Business, CA and Console endpoint.
- `backend_handoff/04_API_DHANI.md`: every Dhani endpoint.
- `backend_handoff/05_DATA_MODEL.md`: tables, keys, indexes, invariants, money and quantity units.
- `backend_handoff/06_QUALITY_AND_OPERATIONS.md`: tests, CI gates, observability, deployment, runbooks.

Where the spec is silent, the front-end logic files are the source of truth for behaviour, field names and maths:
- `byjan-business-web/src/logic/constants.js`: `DOC_T`, `calc()`, `permsFor()`, `PAPPLY`, `RSET0`, `NAV`, `NAV_CA`
- `byjan-business-web/src/logic/BizLogic.js`: `verbs()`, `verb()`, the form specs
- `dhani-khatha-app/src/logic/DhaniLogic.js`: `wStats`, `doReceive`, `doAssign`, `payKooli`, `cutAdv`, `advBack`, `giveAdv`, `takeBack`, `toggleHold`, `moveRemaining`, `saveEd`, `costOf`, `priceOf`

Port the maths exactly, then make it authoritative on the server.

## Non-negotiable rules
1. **Nothing is missing.** Every endpoint in 03 and 04 is implemented, tested and appears in OpenAPI. Keep `docs/COVERAGE.md`, a table of endpoint → handler → tests → status, and never mark an endpoint done without tests.
2. **Nothing is redundant.** Add a resource only when it is truly new; otherwise extend an existing one.
   - The 14 business document types share **one** document engine that uses a DocType registry.
   - All weaver money moves go through **one** endpoint that takes `kind`.
   - Masters use **one** generic endpoint.
   - Undo uses **one** endpoint.
   - If you think an endpoint is needed that isn't in the spec, add it to `docs/DECISIONS.md` with a justification and stop to ask me.
3. **Layering and SOLID** follow 01 exactly:
   - Routers stay thin.
   - Services orchestrate.
   - Domain code is pure and has no I/O.
   - Repositories and gateways sit behind `Protocol` interfaces.
   - No module imports another module's infrastructure. Cross-module calls go through the application service interfaces or domain events.
4. **Security** follows 02 and is never relaxed "for now".
   - Every route declares its permission.
   - Tenant isolation is enforced both by Postgres RLS **and** by repository filters.
   - A generated test proves that every route rejects other tenants.
5. **Money is integer paise (`BIGINT`). Yarn is integer milligrams. Never use floats.** Rounding rules are in 05. The server computes every total, tax, balance, ageing figure, kooli, cost and price. The client only previews.
6. **Every mutation**:
   - is idempotent (`Idempotency-Key` header)
   - is audited (append-only, hash-chained)
   - emits a domain event through the transactional outbox
   - returns the updated resource plus an `undo_token` when the action can be reversed
7. **Concurrency.** Updates carry `If-Match` with the resource `version`, and a stale version returns `412`. Stock, godown tags and balances use row locks (`SELECT … FOR UPDATE`), or they use single-statement conditional updates.
8. **Lists** use cursor (keyset) pagination: default `limit` 25, max 100. No list is unbounded, and none has N+1 queries (a query-count assertion test enforces this).
9. **Migrations** are forward-only Alembic revisions and are reversible where it is safe. No destructive change without a two-step expand/contract.
10. **Existing Node API.** Do not modify the existing `/api` Node functions or their tables. The Python service lives in `services/api/`, uses its own Postgres schemas (`core`, `biz`, `ca`, `dhani`) and identifies users by Firebase UID. The front ends switch domain by domain behind feature flags, following the strangler pattern.
11. **Tests and gates:** ruff, mypy `--strict`, bandit, pip-audit, pytest with at least 90 % coverage on `domain/` and `application/`, and a schemathesis run against OpenAPI. Every phase ends green.
12. **Small commits**, one per checklist item, using Conventional Commits (`feat(dhani): receipts create + preview`).

## Phases (stop after each one and wait for me to reply "continue")
**Phase 0 — Plan (no code).**
- Read everything.
- Produce `docs/COVERAGE.md` with every endpoint from 03 and 04. It must have at least the total row count stated in each file.
- Produce `docs/DECISIONS.md` with any conflicts and your resolutions.
- Produce `docs/EVENTS.md` with every domain event and its consumers.
- Print the counts per module.

**Phase 1 — Skeleton and platform kernel.**
- Repo layout, config (pydantic-settings), DB session and unit of work, RLS plumbing, error model (RFC 9457), pagination, idempotency, ETag and `If-Match`, audit, outbox with the Arq worker, structured logging, OpenTelemetry, health endpoints.
- Docker, docker-compose (Postgres 16, Redis 7, MinIO, ClamAV, Mailpit) and CI.

**Phase 2 — Identity and access.**
- Auth: Firebase exchange, OTP, refresh rotation, MFA, step-up.
- Me, sessions, tenants, members, invites, RBAC (catalogue, roles, matrix, limits, view-as), feature switches.
- Files, notifications, search, undo, exports and jobs, inbound webhooks framework.
- Generated cross-tenant and permission tests.

**Phase 3 — Business ledger core.**
- Chart of accounts, GL posting engine, periods and close, parties, items, the tax engine (GST CGST/SGST/IGST by place of supply, TDS/TCS, round-off) and numbering series.

**Phase 4 — Business document engine.**
- DocType registry for all 14 types, the state machine, actions, conversions, payments and allocations, payment runs, PDFs, email and reminders, attachments, bulk actions, approvals and rules.

**Phase 5 — Business operations.**
- Bank (connections, statement import, lines, match rules, reconciliation), stock and locations, equipment and depreciation, projects, budgets, cash plan, income deals, rentals, tax returns and GSTR-2B, GST entities, inbox (bill reading), imports, org tree, reports, dashboards and insights.

**Phase 6 — CA practice.**
- Clients and open-books, the compliance calendar and generator, tasks board, review queue with its rules engine, document requests, queries (shared with Business), team, time, WIP billing, CA reports.

**Phase 7 — Super-user console.**

**Phase 8 — Dhani Khatha.**
- Masters, rates, designs, setups, weavers, assignments, pieces, yarn, weaver money, receipts, godown, sales, parties, khatha, home and tips, demand, catalogues, search, reports, offline sync, statement sharing.

**Phase 9 — Hardening.**
- Load tests (k6) to the SLOs in 06, the threat-model review against 02, a pen-test checklist, backup and restore drills, and runbooks.
- Generate the TypeScript clients (`openapi-typescript`) into `byjan-business-web/src/api/` and `dhani-khatha-app/src/api/`.
- Replace the front-end seed data behind `useMock` flags, one domain at a time.

## Output for each step
- **Before coding:** a three-bullet plan and the files you will touch.
- **After coding:** a diff summary, the commands you ran and their results (lint, types, tests, coverage), the `COVERAGE.md` rows you changed, and anything you deferred and why.
- Never claim that something passes without showing the command output.

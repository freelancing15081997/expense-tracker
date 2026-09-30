# Test suite — Byjan platform

Deep QA harness for backend + frontend, runnable from Cursor's integrated
terminal or Test panel.

## Backend — `apps/backend` (pytest, 550+ tests)

### One-time setup

```powershell
cd byjan-platform/apps/backend
.venv/Scripts/python -m pip install "pytest>=7.4.3" "pytest-asyncio>=0.21.1" "pytest-cov>=4.1.0" aiosqlite greenlet "bcrypt==4.0.1" email-validator
```

(`greenlet`, `email-validator` and `bcrypt==4.0.1` are declared deps that were
missing from the venv; `bcrypt<4.1` is required by passlib 1.7.4.)

### Run

```powershell
cd byjan-platform/apps/backend
.venv/Scripts/python -m pytest tests -q          # full suite + coverage
.venv/Scripts/python -m pytest tests -q -m db    # only real-DB tests
.venv/Scripts/python -m pytest tests/test_meta.py -q
.venv/Scripts/python -m pytest tests -q -k "otp or rbac"
```

Coverage lands in `apps/backend/htmlcov/index.html` (83% currently).

### What's covered

| File | Scope |
|---|---|
| `test_meta.py` | health/healthz/readyz, root doc, X-Request-ID, OWASP headers, gzip, CORS, RFC-9457 envelope (401/404/405/422/500), OpenAPI |
| `test_unit_shared.py` | Money/Qty/Percent/Result, UUIDv7 ordering, pagination models |
| `test_unit_auth.py` | bcrypt hashing, JWT round-trip, tamper/expired/alg-confusion, refresh token hashing |
| `test_unit_business_rules.py` | GST intra/inter splits, discounts, journals, round-off, TDS, balances, ageing buckets, GSTIN/PAN/IFSC/phone/email validators, numbering, margins |
| `test_api_platform.py` | every `/v1/platform` flow: firebase, OTP, MFA, me, tenants, members/invites, RBAC, files, notifications, search, jobs, exports, audit, webhooks, platform console |
| `test_api_business.py` | every `/v1/biz` flow: dashboard, accounts, periods, parties, items, all 14 doc types + 24 actions, payments, runs, bank, stock/assets/projects/budgets/forecast/deals/leases, tax, inbox, approvals, workbench, queries, reports, imports, org, integrations |
| `test_api_ca.py` | every `/v1/ca` flow: clients, compliance, tasks, review, doc-requests, queries, team, time, billing, reports |
| `test_api_console.py` | `/v1/console` auth matrix (401/403/200) + `@pytest.mark.db` real-DB lifecycle tests |
| `test_rbac_matrix.py` | auto-generated matrix over **every registered route** — anon→401, user→403 on super routes, authed GET sweep |
| `test_security.py` | forged/expired/alg-none tokens, SQL/XSS/traversal/NUL injection, header & method abuse, error-envelope leakage, rate-limit contract |

### xfail convention

Tests for endpoints whose service methods are stub/missing are marked
`pytest.mark.xfail(strict=False)` — the suite stays green today and each one
**flips to XPASS as soon as the real flow is implemented** (visible drift
signal, no silent passes). Currently 6 xfails (e.g. `service.get_me`,
`firebase_exchange` name mismatch, `inbox/address` shape).

### Database tests (`-m db`)

`db`-marked tests auto-detect Postgres:

1. `TEST_DATABASE_URL` env var if set, else
2. docker-compose Postgres `byjan:byjan@localhost:5432/byjan` (TCP probe);
   start with `docker-compose up postgres` from `byjan-platform/`.
3. Otherwise they **skip** — the default run needs no database.

They create schemas (`core`, `biz`, `ca`, `console`) + all ORM tables in the
test DB and roll back per test. The ORM is Postgres-specific (JSONB/ARRAY/
schemas), so SQLite is not a valid substitute — the probe keeps the suite
honest instead of silently mocking.

## Frontend — `apps/frontend` (Vitest, 133 tests)

### One-time setup

```powershell
cd byjan-platform/apps/frontend
npm install
```

### Run

```powershell
cd byjan-platform/apps/frontend
npm test            # vitest run (single pass)
npm run test:watch  # watch mode for development
```

### What's covered

| File | Scope |
|---|---|
| `src/ui/css.test.js` | `css()` parser: kebab→camel, custom props, `!important`, quoted/paren semicolons, cache identity, nullish input |
| `src/ui/Hx.test.jsx` | hover/pressed style application + reset, prop forwarding, handler chaining |
| `src/logic/constants.test.js` | `calc()` GST math (intra/inter, discount, journals, rounding), `genDocs()` determinism & referential integrity, INR formatting, NAV/MOD/DOC_T/STC table integrity, GSTIN length checks |
| `src/logic/BizLogic.test.jsx` | amount-in-words (lakh/crore), `effLine` incl/excl tax modes, `bal`, `nextNo`, `POST_TO`↔status map, `passF` filters |
| `src/layout/Topbar.test.jsx` | **button appearance**: New button gradient/colour/radius/weight/cursor/hover-brightness; bell icon + unread dot; search pill + ⌘K; busy progress bar; dropdown menus with per-item icons |
| `src/layout/Sidebar.test.jsx` | **icon rendering**: every nav/fav icon is a masked span with a valid CDN URL; expanded vs collapsed rail cosmetics; caret rotation; active-item bar; badges; sparkline; user card |
| `src/pages/sections/PageHeader.test.jsx` | action button cosmetics (bg/fg/border/radius/height/cursor), label+icon pairs, hover-dim + press-scale, period pills; **Toast**: icon, tone colour, Undo + close buttons |
| `src/brand/brand.test.jsx` | `ByjanMark`/`ByjanLoader`: svg structure, theme colours (light/dark), unique gradient ids, SMIL draw/pop animations, a11y roles |
| `src/overlays/ProfileMenu.test.jsx` | identity header, per-item icons + callbacks, danger sign-out row, backdrop dismiss |
| `src/auth/auth.test.jsx` | authApi mock mode (password, MFA, sign-up, restore, reset), AuthScreens validation, happy path sign-in → 2-step → signed-in, forgot-password flow, signed-out banners, CTA cosmetics |
| `src/auth/AuthGate.test.jsx` | session restore into app, splash→sign-in transition, sign-out confirm dialog (incl. all-devices), cross-tab sign-out wiring |

Notes:
- Icons are CSS-masked spans (`-webkit-mask: url(phosphor/lucide .svg)`), so
  icon tests assert the mask URL, `currentColor` fill, and expected glyph
  filename — a broken/missing icon URL fails.
- jsdom normalises styles: hex → `rgb(...)`, shorthand → longhands. Tests
  assert the normalised forms.
- `vite.config.js` test block: `pool: threads`, `isolate: false`,
  single worker — tuned for this machine; bump workers if your box is beefier.

## Cursor quick tasks

`.vscode/` is gitignored, but you can drop this into
`byjan-platform/.vscode/tasks.json` for one-click runs
(Terminal → Run Task → `test: all`):

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "test: backend",
      "type": "shell",
      "command": ".venv/Scripts/python -m pytest tests -q",
      "options": { "cwd": "${workspaceFolder}/apps/backend" }
    },
    {
      "label": "test: backend (with DB)",
      "type": "shell",
      "command": ".venv/Scripts/python -m pytest tests -q -m db",
      "options": { "cwd": "${workspaceFolder}/apps/backend" }
    },
    {
      "label": "test: frontend",
      "type": "shell",
      "command": "npm test",
      "options": { "cwd": "${workspaceFolder}/apps/frontend" }
    },
    {
      "label": "test: all",
      "dependsOn": ["test: backend", "test: frontend"],
      "dependsOrder": "sequence"
    }
  ]
}
```

## Known app gaps the suite documents

- `PlatformService` method-name mismatches vs `platform/api.py` (`get_me`,
  `firebase_exchange`, `get_console_overview`, `get_trace_events`,
  `get_integration_health`) — xfail-marked.
- `require_permission` / `require_step_up` / `RateLimitMiddleware` are TODO
  stubs — contract tests document current behaviour.
- JWT is signed HS256 with the configured key material despite
  `JWT_ALGORITHM=EdDSA` in settings — captured in `test_unit_auth.py`.
- `inbox/address` returns `{}` — xfail until email/whatsapp addresses land.

# DECISIONS — Byjan Business handoff vs this repo

## Scope
- **In scope:** Business + platform + CA + console from handoff `00`–`06` and `qa/`.
- **Out of scope this track:** Devin E2E prompt (`07_DEVIN_*`), Money app Node `/api` and Vercel Blob.
- **Money mail:** never modify `/api/email/send` or Money SMTP paths. Business uses `/api/email/relay` only.

## Layout conflict
| Handoff says | This repo uses |
|---|---|
| `services/api/` | `byjan-platform/apps/backend/` |
| `byjan-business-web/` | `byjan-platform/apps/frontend/` |
| `backend_handoff/` | `byjan-platform/docs/handoff/` |

**Decision:** Keep existing `byjan-platform` layout. Do not duplicate a second Python service under `services/api/`.

## Catalogue vs code
- Handoff catalogues list ~222 discrete endpoint rows (03+04).
- Backend already declares **~322** FastAPI route decorations (platform + business + ca + console).
- Many routes are thin wrappers / stubs. Status in `COVERAGE.md` is `partial` when a matching decoration exists — not proof of full domain maths, RLS, or tests.
- **Decision:** Prefer completing stub bodies and Neon persistence over adding redundant parallel endpoints.

## Auth / mail
- Password reset: branded Byjan mail via Business backend → HTTP relay to Cloudflare Express `/api/email/relay` (Render free blocks SMTP). Shared secret `MAIL_RELAY_SECRET`. Does not touch Money `/api/email/send`.
- Firebase continue URL: empty (hosted reset page) to avoid UNAUTHORIZED_DOMAIN.

## Dhani
- Handoff phase 8 remains planned. Routes may be missing or stubbed. Business production MVP is prioritized first; Dhani follows the same platform kernel.

## Frontend
- Packaged brief `web/` is a reference sync source. Live product FE is `byjan-platform/apps/frontend`. Merge brand/auth improvements from the brief without replacing BizLogic wholesale.

## Phases
- Operator asked to complete without stopping at phase gates. Work proceeds continuously; phase checklists still track completeness in COVERAGE.md.

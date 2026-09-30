# Byjan backend handoff

Read these in order. File 00 is the prompt you paste into Cursor.

| File | What it covers |
|---|---|
| `00_CURSOR_MASTER_PROMPT.md` | Paste this into Cursor (Agent mode). It covers the rules, the 10 phases and the output format |
| `01_ARCHITECTURE.md` | Stack (FastAPI, Postgres, Redis, Arq), modules, layering and SOLID, conventions, patterns, performance |
| `02_SECURITY.md` | Auth, MFA, step-up, RLS tenant isolation, RBAC and ABAC, encryption, files, webhooks, audit, CI security |
| `03_API_PLATFORM_AND_BUSINESS.md` | Rows 1–175: platform, Business (the 14-type document engine), CA and super-user console endpoints |
| `04_API_DHANI.md` | Rows D1–D67: Dhani Khatha endpoints, weaver balance formulas and events |
| `05_DATA_MODEL.md` | Every table, unit and invariant |
| `06_QUALITY_AND_OPERATIONS.md` | Tests, CI gates, SLOs, jobs, how to switch the front ends over, runbooks |

**Where to put it.** Place this folder at the repo root, next to `byjan-business-web/`, `dhani-khatha-app/` and `design_handoff_byjan_web/`, so that Cursor can read the front-end logic files the spec refers to.

# Production readiness status (Byjan Business)

## Mail (Cloudflare + Render only — no Vercel)

- **Why not Vercel:** Business mail must not hop through Vercel. Render free blocks SMTP ports; Cloudflare Workers also cannot complete SMTP TLS. Send path is **Brevo HTTPS** (`BREVO_API_KEY`) with From `byjanbooks@easypado.com`.
- **Why mail was @gmail.com:** Render/CF had `SMTP_HOST=smtp.gmail.com` + `SMTP_USER=byjanbooks@gmail.com`. Gmail SMTP forces From = login. Fixed in code to always use `byjanbooks@easypado.com`.
- **Render:** `MAIL_RELAY_URL=https://www.easypado.com/api/email/relay` → CF Worker Brevo HTTPS. Prefer `BREVO_API_KEY` on Render for direct Brevo send.
- **CF Worker:** `POST /api/email/relay` uses Brevo HTTPS only (no Vercel fallback). Money `/api/email/send` untouched.

## Operator: set `BREVO_API_KEY`

1. Brevo dashboard → API keys → copy `xkeysib-…`
2. Cloudflare Worker `easypado-api` secret `BREVO_API_KEY`
3. Render `byjan-business-api` env `BREVO_API_KEY` + `MAIL_FROM=byjanbooks@easypado.com`
4. Remove reliance on Gmail SMTP for Business (`SMTP_HOST` should be Brevo or unused)

## Backend / FE

Document engine, RBAC, LIVE verbs, tenant RLS — on `byjan_business` branch (push to ship on Render).

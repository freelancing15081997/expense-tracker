# Cloudflare Email → Byjan inbound webhook

Catch-all Email Routing on `easypado.com` sends unmatched addresses to Worker
`in-easypado-email-webhook`, which POSTs JSON to:

`https://www.easypado.com/api/email/inbound`

Specific rules stay on Gmail (`support@`, `info@`, `byjanbooks@`, …).
Dynamic ledger addresses (`expense-sample@easypado.com`, etc.) hit catch-all → Worker.

## Deploy

```powershell
cd ops\cf-email-webhook
npm install
npx wrangler secret put WEBHOOK_URL
npx wrangler secret put WEBHOOK_SECRET
npx wrangler deploy
```

No subdomain MX needed. Apex Email Routing MX is enough.

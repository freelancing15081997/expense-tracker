# Cloudflare Email → Byjan inbound webhook

Routes `*@in.easypado.com` through a Cloudflare Email Worker into:

`https://www.easypado.com/api/email/inbound`

Apex addresses that hit this worker (catch-all) are forwarded to Gmail instead.

## Deploy

```powershell
cd ops\cf-email-webhook
npm install

npx wrangler login
# or: npx wrangler deploy --token YOUR_API_TOKEN

npx wrangler secret put WEBHOOK_URL
# https://www.easypado.com/api/email/inbound

npx wrangler secret put WEBHOOK_SECRET
# same value as Vercel INBOUND_WEBHOOK_SECRET

npx wrangler deploy
```

## DNS for subdomain

On zone `easypado.com`, add MX for `in` (same Cloudflare Email Routing MX as apex):

| Type | Name | Priority | Value |
|------|------|----------|--------|
| MX | in | 10 | route1.mx.cloudflare.net |
| MX | in | 20 | route2.mx.cloudflare.net |
| MX | in | 30 | route3.mx.cloudflare.net |

Do **not** point `in` MX at Brevo or a VPS if you use this Worker path.

## Email Routing rule

Prefer keeping specific apex forwards (`support@`, etc.). Point **catch-all** at worker `in-easypado-email-webhook` so unknown addresses (including `*@in.easypado.com`) reach the Worker. The Worker only webhooks `@in.easypado.com`; everything else forwards to `byjanbooks@gmail.com`.

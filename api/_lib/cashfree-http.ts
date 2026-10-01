// Cashfree checkout page, payment return, invoice PDF, and webhook.
// Served from existing Vercel functions (tracker and blob upload) so the Hobby
// plan stays at its 12-function limit.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cfVerifySignature } from './cashfree.js';
import { activate, checkInvoiceSig, invoicePdfBytes } from './billing.js';
import { upsertPayment } from './saas-handlers.js';
import { saasSql } from './saas-schema.js';

const q = (req: VercelRequest, k: string) => { const v = req.query?.[k]; return String(Array.isArray(v) ? v[0] : v || ''); };
const esc = (s: string) => s.replace(/[^a-zA-Z0-9_\-.]/g, '');
const page = (title: string, inner: string, script = '') => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>body{margin:0;font-family:Archivo,system-ui,sans-serif;background:#f3f2f2;color:#201e1d}main{max-width:420px;padding:48px 24px}
h1{font-size:28px;margin:0 0 12px}p{font-size:16px;line-height:1.5}a.btn{display:block;margin-top:24px;padding:14px 16px;background:#ec3013;color:#fff;text-decoration:none;font-weight:600}
hr{border:0;border-top:2px solid #201e1d;margin:0 0 24px}</style></head><body><main><hr>${inner}</main>${script}</body></html>`;

async function rawBody(req: VercelRequest) {
  const chunks: Buffer[] = [];
  for await (const c of req as any) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  return Buffer.concat(chunks).toString('utf8');
}

export async function handleCashfreeWebhook(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
  const raw = await rawBody(req);
  const ok = cfVerifySignature(raw, String(req.headers['x-webhook-timestamp'] || ''), String(req.headers['x-webhook-signature'] || ''));
  if (!ok) { res.statusCode = 401; res.end('bad signature'); return; }
  let evt: any = {};
  try { evt = JSON.parse(raw); } catch { res.statusCode = 400; res.end(); return; }
  try {
    const type = String(evt.type || '');
    const orderId = String(evt.data?.order?.order_id || '');
    const p = evt.data?.payment || {};
    const sql = await saasSql();
    const order = orderId ? (await sql`SELECT * FROM orders WHERE id = ${orderId}`)[0] : null;
    if (order) {
      if (type === 'PAYMENT_SUCCESS_WEBHOOK') {
        await upsertPayment(orderId, order.uid, { ...p, payment_status: 'SUCCESS' });
        await activate(orderId);
      } else if (type === 'PAYMENT_FAILED_WEBHOOK' || type === 'PAYMENT_USER_DROPPED_WEBHOOK') {
        await upsertPayment(orderId, order.uid, { ...p, payment_status: type === 'PAYMENT_FAILED_WEBHOOK' ? 'FAILED' : 'USER_DROPPED' });
        await sql`UPDATE orders SET status = ${type === 'PAYMENT_FAILED_WEBHOOK' ? 'FAILED' : 'USER_DROPPED'} WHERE id = ${orderId} AND activated_at IS NULL`;
        if (order.kind === 'renewal') await sql`UPDATE subscriptions SET status = 'past_due', updated_at = now() WHERE uid = ${order.uid} AND status = 'active' AND current_period_end < now()`;
      }
    }
    if (type === 'REFUND_STATUS_WEBHOOK') {
      const r = evt.data?.refund || {};
      if (r.refund_status === 'SUCCESS' && r.cf_payment_id) {
        await sql`UPDATE payments SET raw = raw || ${JSON.stringify({ lastRefund: r })}::jsonb,
          refunded_paise = GREATEST(refunded_paise, ${Math.round(Number(r.refund_amount || 0) * 100)}) WHERE cf_payment_id = ${String(r.cf_payment_id)}`;
      }
    }
  } catch (e) {
    console.error('cashfree webhook', e);
  }
  res.statusCode = 200; res.setHeader('content-type', 'application/json'); res.end('{"ok":true}');
}

export async function handleCashfreePage(req: VercelRequest, res: VercelResponse) {
  const path = String(req.url || '');
  const op = q(req, 'op');
  res.setHeader('cache-control', 'no-store');

  if (op === 'invoice') {
    const id = q(req, 'id');
    if (!checkInvoiceSig(id, q(req, 'exp'), q(req, 'sig'))) { res.statusCode = 403; res.end('Link expired'); return; }
    const sql = await saasSql();
    const inv = (await sql`SELECT * FROM invoices WHERE id = ${id}`)[0];
    if (!inv) { res.statusCode = 404; res.end('Not found'); return; }
    const pdf = await invoicePdfBytes(inv);
    res.setHeader('content-type', 'application/pdf');
    res.setHeader('content-disposition', `inline; filename="${String(inv.number).replace(/\//g, '-')}.pdf"`);
    res.end(pdf);
    return;
  }

  res.setHeader('content-type', 'text/html; charset=utf-8');
  if (/\/pay\/return/.test(path) || op === 'return') {
    const orderId = esc(q(req, 'order_id'));
    const deep = `com.byjanbooks.app://payment?order_id=${orderId}`;
    res.end(page('Payment received', `<h1>Back to Byjan</h1><p>We’re confirming your payment. Return to the app to see your plan.</p><a class="btn" href="${deep}">Open Byjan</a>`,
      `<script>setTimeout(function(){location.href=${JSON.stringify(deep)}},400)</script>`));
    return;
  }

  const session = q(req, 'session').replace(/[^a-zA-Z0-9_\-]/g, '');
  const mode = q(req, 'mode') === 'production' ? 'production' : 'sandbox';
  if (!session) { res.statusCode = 400; res.end(page('Payment', '<h1>Link not valid</h1><p>Go back to the app and try again.</p>')); return; }
  res.end(page('Pay securely', '<h1>Opening secure payment…</h1><p>If nothing happens, go back to the app and try again.</p>',
    `<script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script><script>
      Cashfree({ mode: ${JSON.stringify(mode)} }).checkout({ paymentSessionId: ${JSON.stringify(session)}, redirectTarget: '_self' });
    </script>`));
}

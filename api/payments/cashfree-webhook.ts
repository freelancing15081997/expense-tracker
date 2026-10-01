// POST /api/payments/cashfree/webhook  (rewritten from vercel.json)
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cfVerifySignature } from '../_lib/cashfree.js';
import { activate } from '../_lib/billing.js';
import { upsertPayment } from '../_lib/saas-handlers.js';
import { saasSql } from '../_lib/saas-schema.js';

export const config = { api: { bodyParser: false } };

async function rawBody(req: VercelRequest) {
  const chunks: Buffer[] = [];
  for await (const c of req as any) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  return Buffer.concat(chunks).toString('utf8');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
        // refunded_paise is already incremented by owner.refund; this confirms or records refunds made from the Cashfree dashboard
        await sql`UPDATE payments SET raw = raw || ${JSON.stringify({ lastRefund: r })}::jsonb,
          refunded_paise = GREATEST(refunded_paise, ${Math.round(Number(r.refund_amount || 0) * 100)}) WHERE cf_payment_id = ${String(r.cf_payment_id)}`;
      }
    }
  } catch (e) {
    console.error('cashfree webhook', e);
  }
  res.statusCode = 200; res.setHeader('content-type', 'application/json'); res.end('{"ok":true}');
}

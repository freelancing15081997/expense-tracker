// Cashfree PG (API version 2023-08-01). Keys stay server-side.
import { createHmac, timingSafeEqual } from 'node:crypto';

const VERSION = '2023-08-01';
export const cfMode = () => (String(process.env.CASHFREE_ENV || 'sandbox').toLowerCase() === 'production' ? 'production' : 'sandbox') as 'sandbox' | 'production';
const base = () => (cfMode() === 'production' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg');

function headers(extra: Record<string, string> = {}) {
  const id = process.env.CASHFREE_APP_ID; const secret = process.env.CASHFREE_SECRET_KEY;
  if (!id || !secret) throw new Error('Payments are not configured');
  return { 'x-client-id': id, 'x-client-secret': secret, 'x-api-version': VERSION, 'content-type': 'application/json', accept: 'application/json', ...extra };
}

async function cf<T = any>(method: string, path: string, body?: unknown, idem?: string): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    method, headers: headers(idem ? { 'x-idempotency-key': idem } : {}), body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = {}; try { json = text ? JSON.parse(text) : {}; } catch { /* ignore */ }
  if (!res.ok) {
    console.error('cashfree', method, path, res.status, text.slice(0, 400));
    const err = new Error('The payment service could not process that. Please try again.') as Error & { status?: number; cf?: unknown };
    err.status = res.status; err.cf = json; throw err;
  }
  return json as T;
}

export function cfCreateOrder(input: {
  orderId: string; amountPaise: number; uid: string; email: string; phone?: string; name?: string; kind: string; returnUrl: string; notifyUrl: string;
}) {
  return cf<{ cf_order_id: string; order_id: string; payment_session_id: string; order_status: string }>('POST', '/orders', {
    order_id: input.orderId,
    order_amount: Number((input.amountPaise / 100).toFixed(2)),
    order_currency: 'INR',
    customer_details: {
      customer_id: input.uid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 50) || 'user',
      customer_email: input.email || undefined,
      customer_phone: /^\d{10}$/.test(String(input.phone || '')) ? input.phone : '9999999999',
      customer_name: input.name || undefined,
    },
    order_meta: { return_url: input.returnUrl, notify_url: input.notifyUrl },
    order_tags: { uid: input.uid.slice(0, 50), kind: input.kind },
  }, input.orderId);
}
export const cfGetOrder = (orderId: string) => cf<{ order_status: string; order_amount: number; cf_order_id: string }>('GET', `/orders/${encodeURIComponent(orderId)}`);
export const cfGetPayments = (orderId: string) => cf<Array<any>>('GET', `/orders/${encodeURIComponent(orderId)}/payments`);
export const cfRefund = (orderId: string, refundId: string, amountPaise: number, note: string) =>
  cf('POST', `/orders/${encodeURIComponent(orderId)}/refunds`, { refund_amount: Number((amountPaise / 100).toFixed(2)), refund_id: refundId, refund_note: note.slice(0, 100) }, refundId);

/** signature = base64(HMAC-SHA256(timestamp + rawBody, secret)). */
export function cfVerifySignature(rawBody: string, timestamp: string, signature: string) {
  const secret = process.env.CASHFREE_WEBHOOK_SECRET || process.env.CASHFREE_SECRET_KEY || '';
  if (!secret || !timestamp || !signature) return false;
  const expected = createHmac('sha256', secret).update(timestamp + rawBody).digest('base64');
  const a = Buffer.from(expected); const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Pick the most relevant payment row from GET /orders/{id}/payments. */
export function pickPayment(rows: Array<any>) {
  if (!Array.isArray(rows) || !rows.length) return null;
  return rows.find((p) => p.payment_status === 'SUCCESS') || rows.sort((a, b) => String(b.payment_time || '').localeCompare(String(a.payment_time || '')))[0];
}
export function methodOf(p: any) {
  const m = p?.payment_group || Object.keys(p?.payment_method || {})[0] || '';
  return String(m).replace('_', ' ');
}

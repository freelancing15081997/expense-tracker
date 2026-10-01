// GET /pay/cashfree?session=&order=&mode=   → hosted checkout launcher
// GET /pay/return?order_id=                  → "return to the app" page + deep link
// GET /api/payments/cashfree-page?op=invoice&id=&exp=&sig=  → signed invoice PDF
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkInvoiceSig, invoicePdfBytes } from '../_lib/billing.js';
import { saasSql } from '../_lib/saas-schema.js';

const q = (req: VercelRequest, k: string) => { const v = req.query?.[k]; return String(Array.isArray(v) ? v[0] : v || ''); };
const esc = (s: string) => s.replace(/[^a-zA-Z0-9_\-.]/g, '');
const page = (title: string, inner: string, script = '') => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>body{margin:0;font-family:Archivo,system-ui,sans-serif;background:#f3f2f2;color:#201e1d}main{max-width:420px;padding:48px 24px}
h1{font-size:28px;margin:0 0 12px}p{font-size:16px;line-height:1.5}a.btn{display:block;margin-top:24px;padding:14px 16px;background:#ec3013;color:#fff;text-decoration:none;font-weight:600}
hr{border:0;border-top:2px solid #201e1d;margin:0 0 24px}</style></head><body><main><hr>${inner}</main>${script}</body></html>`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

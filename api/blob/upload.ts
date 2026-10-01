// Replaces api/blob/upload.ts — adds the storage_mb quota (counted per uid, lifetime, in usage_counters period 'all').
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleBlobUploadRequest } from '../_lib/blob-store.js';
import { verifyFirebaseUser } from '../_pg-tables.js';
import { saasSql } from '../_lib/saas-schema.js';
import { checkCount } from '../_lib/entitlements.js';

export const config = { api: { bodyParser: false } };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const hinted = req.query?.op;
  if (String(Array.isArray(hinted) ? hinted[0] : hinted || '') === 'cashfree-webhook') {
    const { handleCashfreeWebhook } = await import('../_lib/cashfree-http.js');
    await handleCashfreeWebhook(req, res);
    return;
  }
  if (req.method === 'POST') {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const user = token ? await verifyFirebaseUser(token).catch(() => null) : null;
    const bytes = Number(req.headers['content-length'] || 0);
    if (user && bytes > 0) {
      const mb = Math.max(1, Math.ceil(bytes / 1_000_000));
      try {
        const sql = await saasSql();
        const cur = await sql`SELECT used FROM usage_counters WHERE uid = ${user.uid} AND period = 'all' AND meter = 'storage_mb'`;
        await checkCount(user.uid, 'storage_mb', Number(cur[0]?.used || 0), mb);
        const origEnd = (res as any).end.bind(res);
        (res as any).end = (...args: any[]) => {
          if (Number(res.statusCode) < 300) {
            sql`INSERT INTO usage_counters (uid, period, meter, used) VALUES (${user.uid}, 'all', 'storage_mb', ${mb})
              ON CONFLICT (uid, period, meter) DO UPDATE SET used = usage_counters.used + ${mb}`.catch(() => undefined);
          }
          return origEnd(...args);
        };
      } catch (e: any) {
        res.statusCode = e?.status || 402;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ error: 'Your receipt storage is full. Upgrade or add storage to keep attaching files.', ...(e?.extra || {}), meter: 'storage_mb' }));
        return;
      }
    }
  }
  await handleBlobUploadRequest(req, res);
}

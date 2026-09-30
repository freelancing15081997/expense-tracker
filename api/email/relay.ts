/**
 * Legacy Vercel stub — Business mail must use Cloudflare /api/email/relay only
 * (Render → www.easypado.com). Kept so old deploys do not 500; does not send.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors } from '../_lib/http.js';

function json(res: VercelResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  return json(res, 410, {
    error: 'Business mail relay runs on Cloudflare only. Set MAIL_RELAY_URL=https://www.easypado.com/api/email/relay',
  });
}

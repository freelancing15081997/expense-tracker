import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors } from '../_lib/http.js';

/** One-click List-Unsubscribe target. Gmail POSTs here; always 200 so the header stays valid. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(req as any, res as any);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  res.statusCode = 200;
  res.setHeader('content-type', 'text/plain; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end('Unsubscribed');
}

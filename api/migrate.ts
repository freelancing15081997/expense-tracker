import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, readNeonSession, sendJson } from './_lib/helpers';
import { importFirestoreForUser } from './_lib/firestore-import';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }
  const session = await readNeonSession(req);
  if (!session?.uid) {
    sendJson(res, 401, { error: 'Sign in required' });
    return;
  }
  try {
    const result = await importFirestoreForUser(session.uid, String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
    sendJson(res, 200, result);
  } catch (err: any) {
    sendJson(res, 500, { error: err?.message || 'Copy failed' });
  }
}

export const config = { maxDuration: 60 };

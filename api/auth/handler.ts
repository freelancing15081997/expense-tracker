import type { IncomingMessage, ServerResponse } from 'http';
import { kvGet } from '../vercel/db';
import { readJsonBody, readNeonSession, sendJson } from '../vercel/helpers';

function publicUser(uid: string, email: string, displayName: string, extra?: Record<string, unknown> | null) {
  return {
    uid,
    email: extra?.email || email,
    displayName: extra?.displayName || displayName,
    defaultCurrency: extra?.defaultCurrency || 'INR',
    customCategories: extra?.customCategories || [],
    createdAt: extra?.createdAt,
  };
}

export async function handleAuthRequest(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  const url = new URL(req.url || '/', 'http://local');
  const action = url.searchParams.get('action') || '';

  try {
    if (req.method === 'GET' && (action === 'me' || url.pathname.endsWith('/me'))) {
      const session = await readNeonSession(req);
      if (!session) {
        sendJson(res, 200, { user: null });
        return;
      }
      const profile = await kvGet(`users/${session.uid}`);
      sendJson(res, 200, { user: publicUser(session.uid, session.email, session.displayName, profile) });
      return;
    }

    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      const op = String(body.op || action || '');
      if (op === 'logout') {
        sendJson(res, 200, { ok: true });
        return;
      }
    }

    sendJson(res, 405, { error: 'Use Neon Auth on the client to sign in or register' });
  } catch (err: any) {
    sendJson(res, 500, { error: err?.message || 'Auth failed' });
  }
}

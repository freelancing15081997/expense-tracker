import type { IncomingMessage, ServerResponse } from 'http';
import { kvGet } from '../vercel/db';
import { applyCors, readJsonBody, readNeonSession, requestPath, sendJson } from '../vercel/helpers';
import { neonAuthSuffix, proxyToNeonAuth } from '../vercel/auth-proxy';
import { remapFirebaseUidIfNeeded } from '../vercel/remap';

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
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const url = requestPath(req);
  const extra = neonAuthSuffix(url.pathname);
  const action = url.searchParams.get('action') || '';

  try {
    if (req.method === 'GET' && (action === 'me' || extra === 'me' || url.pathname.endsWith('/me'))) {
      const session = await readNeonSession(req);
      if (!session) {
        sendJson(res, 200, { user: null });
        return;
      }
      await remapFirebaseUidIfNeeded(session);
      const profile = await kvGet(`users/${session.uid}`);
      sendJson(res, 200, { user: publicUser(session.uid, session.email, session.displayName, profile) });
      return;
    }

    if (req.method === 'POST' && (!extra || extra === '')) {
      const body = await readJsonBody(req);
      const op = String(body.op || action || '');
      if (op === 'logout') {
        sendJson(res, 200, { ok: true });
        return;
      }
      req.body = body;
    }

    await proxyToNeonAuth(req, res, extra);
  } catch (err: any) {
    sendJson(res, 500, { error: err?.message || 'Auth failed' });
  }
}

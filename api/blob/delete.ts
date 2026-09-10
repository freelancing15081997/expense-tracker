import type { VercelRequest, VercelResponse } from '@vercel/node';

const FIREBASE_PROJECT = 'gen-lang-client-0616065043';

function json(res: VercelResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
}

async function requireUid(req: VercelRequest) {
  const header = String(req.headers.authorization || '');
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) return '';
  const { createRemoteJWKSet, jwtVerify } = await import('jose');
  const { payload } = await jwtVerify(
    token,
    createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')),
    {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT}`,
      audience: FIREBASE_PROJECT,
    },
  );
  return String(payload.user_id || payload.sub || '');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const origin = String(req.headers.origin || '');
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    if (origin) res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    if (req.method !== 'POST') {
      json(res, 405, { error: 'POST required' });
      return;
    }
    const uid = await requireUid(req);
    if (!uid) {
      json(res, 401, { error: 'Sign in required' });
      return;
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const url = String(body.url || body.pathname || '').trim();
    if (!url) {
      json(res, 400, { error: 'Missing blob url' });
      return;
    }
    const allowed =
      url.startsWith('erp_workspaces/') ||
      url.includes('.blob.vercel-storage.com/') ||
      url.includes('blob.vercel-storage.com/');
    if (!allowed) {
      json(res, 400, { error: 'Invalid blob url' });
      return;
    }
    if (url.startsWith('erp_workspaces/')) {
      const workspaceId = url.split('/').filter(Boolean)[1] || '';
      if (workspaceId !== uid && !workspaceId.startsWith(`${uid}_`)) {
        json(res, 403, { error: 'Not allowed to delete this Books file' });
        return;
      }
    }
    const { del } = await import('@vercel/blob');
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    await del(url, token ? { token } : {});
    json(res, 200, { ok: true });
  } catch (err: any) {
    json(res, 500, { error: err?.message || 'Delete failed' });
  }
}

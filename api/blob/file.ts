import type { VercelRequest, VercelResponse } from '@vercel/node';
import { r2FileKey, r2GetBytes } from '../_lib/r2';

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
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    if (req.method !== 'GET') {
      json(res, 405, { error: 'GET required' });
      return;
    }
    const uid = await requireUid(req);
    if (!uid) {
      json(res, 401, { error: 'Sign in required' });
      return;
    }
    const url = new URL(req.url || '/', 'https://local.invalid');
    const target = String(url.searchParams.get('url') || url.searchParams.get('path') || '').trim();
    if (!target) {
      json(res, 400, { error: 'Missing file' });
      return;
    }
    let key = '';
    try {
      key = r2FileKey(target);
    } catch {
      json(res, 400, { error: 'Invalid file' });
      return;
    }
    const workspaceId = key.split('/').filter(Boolean)[1] || '';
    if (workspaceId !== uid && !workspaceId.startsWith(`${uid}_`)) {
      json(res, 403, { error: 'Not allowed to read this Books file' });
      return;
    }
    const file = await r2GetBytes(key);
    if (!file) {
      json(res, 404, { error: 'File not found' });
      return;
    }
    res.statusCode = 200;
    res.setHeader('content-type', file.contentType);
    res.setHeader('cache-control', 'private, max-age=3600');
    res.end(file.body);
  } catch (err: any) {
    json(res, 500, { error: err?.message || 'File read failed' });
  }
}

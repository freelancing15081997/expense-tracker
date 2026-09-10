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

function blobAuth() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const storeId = process.env.BLOB_STORE_ID;
  return {
    ...(token ? { token } : {}),
    ...(storeId ? { storeId } : {}),
  };
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
    const allowed =
      target.startsWith('erp_workspaces/') ||
      target.includes('.blob.vercel-storage.com/') ||
      target.includes('blob.vercel-storage.com/');
    if (!allowed) {
      json(res, 400, { error: 'Invalid file' });
      return;
    }
    const { get } = await import('@vercel/blob');
    const result = await get(target, { access: 'private', useCache: true, ...blobAuth() });
    if (!result || result.statusCode !== 200 || !result.stream) {
      json(res, 404, { error: 'File not found' });
      return;
    }
    const contentType = result.blob.contentType || 'application/octet-stream';
    res.statusCode = 200;
    res.setHeader('content-type', contentType);
    res.setHeader('cache-control', 'private, max-age=3600');
    const buf = Buffer.from(await new Response(result.stream).arrayBuffer());
    res.end(buf);
  } catch (err: any) {
    json(res, 500, { error: err?.message || 'File read failed' });
  }
}

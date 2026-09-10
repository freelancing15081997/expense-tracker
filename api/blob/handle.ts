import type { VercelRequest, VercelResponse } from '@vercel/node';

const FIREBASE_PROJECT = 'gen-lang-client-0616065043';
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_EXT = new Set(['pdf', 'png', 'jpg', 'jpeg', 'webp', 'csv', 'txt', 'xlsx']);
const ALLOWED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

function json(res: VercelResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
}

function header(req: VercelRequest, name: string) {
  const value = req.headers[name] ?? req.headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] || '';
  return String(value || '');
}

function safeId(value: string) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
}

function readJson(req: VercelRequest): any {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body) return JSON.parse(req.body);
  return null;
}

async function requireUid(req: VercelRequest) {
  const auth = header(req, 'authorization');
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
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

function assertPath(pathname: string, uid: string, clientPayload: string | null) {
  const match = String(pathname || '').match(/^erp_workspaces\/([^/]+)\/files\/([^/]+)\.([a-z0-9]+)$/i);
  if (!match) throw new Error('Invalid upload path');
  const tenant = safeId(match[1]);
  const fileId = safeId(match[2]);
  const ext = match[3].toLowerCase();
  if (tenant !== safeId(uid)) throw new Error('Upload is not allowed for this workspace');
  if (tenant.length < 4 || fileId.length < 4 || !ALLOWED_EXT.has(ext)) throw new Error('Invalid upload path');
  if (clientPayload) {
    try {
      const extra = JSON.parse(clientPayload) as { tenantId?: string };
      if (extra.tenantId && safeId(extra.tenantId) !== tenant) throw new Error('Upload is not allowed for this workspace');
    } catch (err: any) {
      if (String(err?.message || '').includes('not allowed')) throw err;
    }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const origin = String(req.headers.origin || '');
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    if (origin) res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type,X-Tenant-Id,X-File-Id,X-File-Ext,X-File-Name,X-Content-Type,vercel-blob-api-version');
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

    const body = readJson(req);
    if (!body || typeof body !== 'object') {
      json(res, 400, { error: 'Invalid upload request' });
      return;
    }

    if (body.type === 'blob.upload-completed') {
      json(res, 200, { type: 'blob.upload-completed', response: 'ok' });
      return;
    }

    const pathname = String(body.payload?.pathname || body.pathname || '');
    const clientPayload = body.payload?.clientPayload ?? body.clientPayload ?? null;
    assertPath(pathname, uid, clientPayload);

    const { generateClientTokenFromReadWriteToken } = await import('@vercel/blob/client');
    const clientToken = await generateClientTokenFromReadWriteToken({
      pathname,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      allowedContentTypes: ALLOWED_TYPES,
      maximumSizeInBytes: MAX_BYTES,
      addRandomSuffix: false,
      allowOverwrite: true,
      validUntil: Date.now() + 30 * 60 * 1000,
    } as any);
    json(res, 200, { type: 'blob.generate-client-token', clientToken });
  } catch (err: any) {
    json(res, err?.statusCode || 400, { error: err?.message || 'Upload failed' });
  }
}

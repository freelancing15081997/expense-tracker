import type { VercelRequest, VercelResponse } from '@vercel/node';

const FIREBASE_PROJECT = 'gen-lang-client-0616065043';
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_EXT = new Set(['pdf', 'png', 'jpg', 'jpeg', 'webp', 'csv', 'txt', 'xlsx']);
const ALLOWED_MIME: Record<string, string[]> = {
  pdf: ['application/pdf'],
  png: ['image/png'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  webp: ['image/webp'],
  csv: ['text/csv', 'application/vnd.ms-excel', 'text/plain'],
  txt: ['text/plain'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
};

export const config = { api: { bodyParser: false } };

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

function readBody(req: VercelRequest): Promise<Buffer> {
  if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
  if (req.body instanceof Uint8Array) return Promise.resolve(Buffer.from(req.body));
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
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
    const origin = String(req.headers.origin || '');
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    if (origin) res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type,X-Tenant-Id,X-File-Id,X-File-Ext,X-File-Name,X-Content-Type');
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

    const tenantId = header(req, 'x-tenant-id').trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
    const fileId = header(req, 'x-file-id').trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
    const ext = header(req, 'x-file-ext').trim().toLowerCase();
    const contentType = (header(req, 'content-type') || header(req, 'x-content-type')).split(';')[0].trim().toLowerCase();
    if (tenantId.length < 4 || fileId.length < 4) {
      json(res, 400, { error: 'Invalid upload path' });
      return;
    }
    const uidSafe = uid.replace(/[^a-zA-Z0-9_-]/g, '_');
    if (tenantId !== uidSafe && !tenantId.startsWith(`${uidSafe}_`)) {
      json(res, 403, { error: 'Not allowed to upload into this Books workspace' });
      return;
    }
    if (!ALLOWED_EXT.has(ext)) {
      json(res, 400, { error: 'File type is not allowed' });
      return;
    }
    if (contentType && ALLOWED_MIME[ext] && !ALLOWED_MIME[ext].includes(contentType)) {
      json(res, 400, { error: 'File extension does not match its type' });
      return;
    }
    const body = await readBody(req);
    if (!body.length || body.length > MAX_BYTES) {
      json(res, 400, { error: 'File must be between 1 byte and 8 MB' });
      return;
    }

    const { put } = await import('@vercel/blob');
    const pathname = `erp_workspaces/${tenantId}/files/${fileId}.${ext}`;
    const blob = await put(pathname, body, {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: contentType || ALLOWED_MIME[ext][0],
      ...blobAuth(),
    });
    const url = (blob as { downloadUrl?: string }).downloadUrl || blob.url || pathname;
    json(res, 200, { url, pathname: blob.pathname || pathname });
  } catch (err: any) {
    json(res, 500, { error: err?.message || 'Upload failed' });
  }
}

import { del, put } from '@vercel/blob';
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'http';
import { requireUser } from '../vercel/helpers';

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

function header(headers: IncomingHttpHeaders, name: string) {
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
}

function readBody(req: IncomingMessage & { body?: unknown }): Promise<Buffer> {
  if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
  if (req.body instanceof Uint8Array) return Promise.resolve(Buffer.from(req.body));
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function token() {
  const value = process.env.BLOB_READ_WRITE_TOKEN;
  if (!value) throw new Error('Blob storage is not configured');
  return value;
}

function blobErrorStatus(err: any) {
  const status = Number(err?.status || err?.statusCode || 0);
  if (status === 429 || /429|rate.?limit/i.test(String(err?.message || ''))) return 429;
  if (err?.message === 'Blob storage is not configured') return 503;
  return 500;
}

function blobErrorMessage(err: any, fallback: string) {
  if (err?.message === 'Blob storage is not configured') return err.message;
  if (blobErrorStatus(err) === 429) return 'Blob storage rate limit reached. Wait a minute and try again.';
  return fallback;
}

export async function handleBlobUploadRequest(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse,
) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const uid = await requireUser(req, res);
  if (!uid) return;

  try {
    const tenantId = header(req.headers, 'x-tenant-id').trim();
    const fileId = header(req.headers, 'x-file-id').trim();
    const ext = header(req.headers, 'x-file-ext').trim().toLowerCase();
    const contentType = (header(req.headers, 'content-type') || header(req.headers, 'x-content-type')).split(';')[0].trim().toLowerCase();

    if (!/^[a-zA-Z0-9_-]{6,128}$/.test(tenantId) || !/^[a-zA-Z0-9_-]{6,128}$/.test(fileId)) {
      sendJson(res, 400, { error: 'Invalid upload path' });
      return;
    }
    if (!ALLOWED_EXT.has(ext)) {
      sendJson(res, 400, { error: 'File type is not allowed' });
      return;
    }
    if (contentType && !ALLOWED_MIME[ext].includes(contentType)) {
      sendJson(res, 400, { error: 'File extension does not match its type' });
      return;
    }

    const body = await readBody(req);
    if (!body.length || body.length > MAX_BYTES) {
      sendJson(res, 400, { error: 'File must be between 1 byte and 8 MB' });
      return;
    }

    const pathname = `erp_workspaces/${tenantId}/files/${fileId}.${ext}`;
    const blob = await put(pathname, body, {
      access: 'public',
      token: token(),
      ...(process.env.BLOB_STORE_ID ? { storeId: process.env.BLOB_STORE_ID } : {}),
      contentType: contentType || ALLOWED_MIME[ext][0],
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    });

    sendJson(res, 200, { url: blob.url, pathname: blob.pathname });
  } catch (err: any) {
    sendJson(res, blobErrorStatus(err), { error: blobErrorMessage(err, 'Upload failed') });
  }
}

export async function handleBlobDeleteRequest(
  req: IncomingMessage & { body?: any },
  res: ServerResponse,
) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const uid = await requireUser(req, res);
  if (!uid) return;

  try {
    const payload = req.body && typeof req.body === 'object' ? req.body : JSON.parse((await readBody(req)).toString('utf8') || '{}');
    const url = String(payload.url || payload.pathname || '').trim();
    if (!url) {
      sendJson(res, 400, { error: 'Missing blob url' });
      return;
    }
    const allowed =
      url.startsWith('erp_workspaces/') ||
      url.includes('.blob.vercel-storage.com/') ||
      url.includes('blob.vercel-storage.com/');
    if (!allowed) {
      sendJson(res, 400, { error: 'Invalid blob url' });
      return;
    }
    await del(url, { token: token() });
    sendJson(res, 200, { ok: true });
  } catch (err: any) {
    sendJson(res, blobErrorStatus(err), { error: blobErrorMessage(err, 'Delete failed') });
  }
}

import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'http';
import { applyCors, requireUser } from './helpers.js';
import { r2Del, r2FileKey, r2PutBytes } from './r2.js';

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

function storeErrorStatus(err: any) {
  const status = Number(err?.status || err?.statusCode || 0);
  if (status >= 400 && status < 600) return status;
  if (status === 429 || /429|rate.?limit/i.test(String(err?.message || ''))) return 429;
  if (String(err?.message || '').includes('not configured')) return 503;
  return 500;
}

function decodeBase64Payload(raw: string) {
  const cleaned = String(raw || '').replace(/^data:[^;]+;base64,/i, '').replace(/\s+/g, '');
  if (!cleaned) return Buffer.alloc(0);
  return Buffer.from(cleaned, 'base64');
}

function storeErrorMessage(err: any, fallback: string) {
  const msg = String(err?.message || '').trim();
  if (msg.includes('not configured')) return msg;
  if (storeErrorStatus(err) === 429) return 'File storage rate limit reached. Wait a minute and try again.';
  if (storeErrorStatus(err) === 403 && msg) return msg;
  return msg || fallback;
}

async function requireBookMember(uid: string, bookId: string, writer = false) {
  const { ledgerMember } = await import('../_pg-tables.js');
  const member = await ledgerMember(bookId, uid);
  if (!member) {
    const err: Error & { status?: number } = new Error('Not allowed to access this ledger file');
    err.status = 403;
    throw err;
  }
  if (writer && !['owner', 'admin', 'contributor'].includes(member.role)) {
    const err: Error & { status?: number } = new Error('Not allowed to change this ledger file');
    err.status = 403;
    throw err;
  }
}

export async function handleBlobUploadRequest(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse,
) {
  applyCors(req, res);
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
    const rawBody = await readBody(req);
    if (rawBody.length > MAX_BYTES + 512 * 1024) {
      sendJson(res, 413, { error: 'File is too large for upload' });
      return;
    }
    const declaredType = (header(req.headers, 'content-type') || '').split(';')[0].trim().toLowerCase();
    const isJsonUpload =
      declaredType === 'application/json' ||
      (rawBody.length > 1 && rawBody.length < 3.2 * 1024 * 1024 && rawBody[0] === 0x7b /* { */);

    let bookId = header(req.headers, 'x-book-id').trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
    let tenantId = header(req.headers, 'x-tenant-id').trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
    let fileId = header(req.headers, 'x-file-id').trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
    let ext = header(req.headers, 'x-file-ext').trim().toLowerCase();
    let contentType = (header(req.headers, 'x-content-type') || (!isJsonUpload ? declaredType : '')).split(';')[0].trim().toLowerCase();
    let body = rawBody;

    if (isJsonUpload) {
      if (rawBody.length > 3.2 * 1024 * 1024) {
        sendJson(res, 413, { error: 'Receipt payload too large. Use a smaller photo.' });
        return;
      }
      let payload: Record<string, unknown> = {};
      try {
        payload = JSON.parse(rawBody.toString('utf8') || '{}');
      } catch {
        sendJson(res, 400, { error: 'Invalid upload JSON' });
        return;
      }
      bookId = String(payload.bookId || bookId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
      tenantId = String(payload.tenantId || tenantId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
      fileId = String(payload.fileId || fileId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
      ext = String(payload.ext || payload.fileExt || ext || '').trim().toLowerCase();
      contentType = String(payload.contentType || payload.mimeType || contentType || '').split(';')[0].trim().toLowerCase();
      body = decodeBase64Payload(String(payload.dataBase64 || payload.base64 || payload.data || ''));
    }

    if (fileId.length < 4) {
      sendJson(res, 400, { error: 'Invalid upload path' });
      return;
    }
    let pathname = '';
    if (bookId.length >= 4) {
      await requireBookMember(uid, bookId, true);
      pathname = `books/${bookId}/files/${fileId}.${ext}`;
    } else {
      if (tenantId.length < 4) {
        sendJson(res, 400, { error: 'Invalid upload path' });
        return;
      }
      const uidSafe = uid.replace(/[^a-zA-Z0-9_-]/g, '_');
      if (tenantId !== uidSafe && !tenantId.startsWith(`${uidSafe}_`)) {
        sendJson(res, 403, { error: 'Not allowed to upload into this Books workspace' });
        return;
      }
      pathname = `erp_workspaces/${tenantId}/files/${fileId}.${ext}`;
    }
    if (!ALLOWED_EXT.has(ext)) {
      sendJson(res, 400, { error: 'File type is not allowed' });
      return;
    }
    if (contentType && !ALLOWED_MIME[ext].includes(contentType)) {
      sendJson(res, 400, { error: 'File extension does not match its type' });
      return;
    }

    if (!body.length || body.length > MAX_BYTES) {
      sendJson(res, 400, { error: 'File must be between 1 byte and 8 MB' });
      return;
    }

    await r2PutBytes(pathname, body, contentType || ALLOWED_MIME[ext][0]);
    sendJson(res, 200, { url: pathname, pathname, path: pathname });
  } catch (err: any) {
    sendJson(res, storeErrorStatus(err), { error: storeErrorMessage(err, 'Upload failed') });
  }
}

export async function handleBlobDeleteRequest(
  req: IncomingMessage & { body?: any },
  res: ServerResponse,
) {
  applyCors(req, res);
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
      sendJson(res, 400, { error: 'Missing file path' });
      return;
    }
    const key = r2FileKey(url);
    const parts = key.split('/').filter(Boolean);
    if (parts[0] === 'books') {
      await requireBookMember(uid, parts[1] || '', true);
    } else {
      const workspaceId = parts[1] || '';
      if (workspaceId !== uid && !workspaceId.startsWith(`${uid}_`)) {
        sendJson(res, 403, { error: 'Not allowed to delete this Books file' });
        return;
      }
    }
    await r2Del(key);
    sendJson(res, 200, { ok: true });
  } catch (err: any) {
    sendJson(res, storeErrorStatus(err), { error: storeErrorMessage(err, 'Delete failed') });
  }
}

import type { VercelRequest, VercelResponse } from '@vercel/node';

function json(res: VercelResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
}

async function mailboxAllows(uid: string, fileKey: string) {
  if (fileKey.startsWith('books/')) {
    const bookId = fileKey.split('/')[1] || '';
    if (!bookId) return false;
    const { ledgerMember } = await import('../_pg-tables.js');
    return Boolean(await ledgerMember(bookId, uid));
  }
  const workspaceId = fileKey.split('/').filter(Boolean)[1] || '';
  return workspaceId === uid || workspaceId.startsWith(`${uid}_`);
}

function sniffContentType(body: Buffer, stored: string, objectKey: string) {
  if (body.length >= 4 && body[0] === 0x25 && body[1] === 0x50 && body[2] === 0x44 && body[3] === 0x46) {
    return 'application/pdf';
  }
  if (body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff) return 'image/jpeg';
  if (body.length >= 4 && body[0] === 0x89 && body[1] === 0x50 && body[2] === 0x4e && body[3] === 0x47) return 'image/png';
  const lowerKey = objectKey.toLowerCase();
  if (lowerKey.endsWith('.pdf')) return 'application/pdf';
  const t = String(stored || '').toLowerCase();
  if (t.includes('pdf')) return 'application/pdf';
  if (t.startsWith('image/')) return t.split(';')[0];
  return stored || 'application/octet-stream';
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
    const header = String(req.headers.authorization || '');
    const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
    const { verifyFirebaseUser } = await import('../_pg-tables.js');
    const user = token ? await verifyFirebaseUser(token) : null;
    if (!user?.uid) {
      json(res, 401, { error: 'Sign in required' });
      return;
    }
    const url = new URL(req.url || '/', 'https://local.invalid');
    const target = String(url.searchParams.get('url') || url.searchParams.get('path') || '').trim();
    if (!target) {
      json(res, 400, { error: 'Missing file' });
      return;
    }
    const { r2FileKey, r2GetBytes, r2Ready } = await import('../_lib/r2.js');
    if (!r2Ready()) {
      json(res, 503, { error: 'File storage is not configured on this server' });
      return;
    }
    let key = '';
    try {
      key = r2FileKey(target);
    } catch {
      json(res, 400, { error: 'Invalid file' });
      return;
    }
    const allowed = await mailboxAllows(user.uid, key);
    if (!allowed) {
      json(res, 403, { error: 'Not allowed to read this file' });
      return;
    }
    const file = await r2GetBytes(key);
    if (!file) {
      json(res, 404, { error: 'File not found' });
      return;
    }
    const contentType = sniffContentType(file.body, file.contentType, key);
    res.statusCode = 200;
    res.setHeader('content-type', contentType);
    res.setHeader('cache-control', 'private, max-age=3600');
    res.end(file.body);
  } catch (err: any) {
    json(res, 500, { error: err?.message || 'File read failed' });
  }
}

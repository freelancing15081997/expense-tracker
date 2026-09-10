import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash, createHmac } from 'node:crypto';

const R2_REGION = 'auto';
const R2_SERVICE = 's3';

function r2Cfg() {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
  const endpoint = (process.env.R2_ENDPOINT || '').replace(/\/+$/, '');
  const bucket = process.env.R2_BUCKET_NAME || '';
  if (!accessKeyId || !secretAccessKey || !endpoint || !bucket) {
    throw new Error('Cloudflare R2 is not configured. Set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, and R2_BUCKET_NAME.');
  }
  return { accessKeyId, secretAccessKey, endpoint, bucket, host: new URL(endpoint).host };
}

function r2Sha256(data: Buffer | string) {
  return createHash('sha256').update(data).digest('hex');
}

function r2Hmac(key: Buffer | string, data: string) {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function r2Encode(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
}

async function r2Fetch(method: string, key: string) {
  const { accessKeyId, secretAccessKey, endpoint, bucket, host } = r2Cfg();
  const objectPath = `/${bucket}/${key.split('/').filter(Boolean).map(r2Encode).join('/')}`;
  const href = `${endpoint}${objectPath}`;
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = r2Sha256(Buffer.alloc(0));
  const headers: Record<string, string> = { host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate };
  const signed = Object.keys(headers).sort();
  const canonicalHeaders = signed.map((name) => `${name}:${headers[name]}\n`).join('');
  const signedHeaders = signed.join(';');
  const canonicalRequest = [method, objectPath, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${dateStamp}/${R2_REGION}/${R2_SERVICE}/aws4_request`;
  const kSigning = r2Hmac(r2Hmac(r2Hmac(r2Hmac(`AWS4${secretAccessKey}`, dateStamp), R2_REGION), R2_SERVICE), 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(['AWS4-HMAC-SHA256', amzDate, scope, r2Sha256(canonicalRequest)].join('\n'), 'utf8').digest('hex');
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return fetch(href, { method, headers });
}

function r2FileKey(target: string) {
  const raw = String(target || '').trim().replace(/^\/+/, '');
  if (raw.startsWith('erp_workspaces/')) return raw;
  if (/^books\/[a-zA-Z0-9_-]+\/files\/[a-zA-Z0-9_.-]+$/.test(raw)) return raw;
  try {
    const url = new URL(raw);
    const path = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
    const idx = path.indexOf('erp_workspaces/');
    if (idx >= 0) return path.slice(idx);
    const books = path.match(/books\/[a-zA-Z0-9_-]+\/files\/[a-zA-Z0-9_.-]+/);
    if (books) return books[0];
  } catch {
    // Not a URL.
  }
  throw new Error('Invalid file');
}

async function mailboxAllows(uid: string, fileKey: string) {
  if (!fileKey.startsWith('books/')) return fileKey.split('/').filter(Boolean)[1] === uid || fileKey.split('/').filter(Boolean)[1]?.startsWith(`${uid}_`);
  const bookId = fileKey.split('/')[1] || '';
  if (!bookId) return false;
  const keys = [`documents/inbound_mailboxes/${bookId}.json`, `documents/books/${bookId}.json`];
  for (const key of keys) {
    try {
      const res = await r2Fetch('GET', key);
      if (!res.ok) continue;
      const data = JSON.parse(Buffer.from(await res.arrayBuffer()).toString('utf8'));
      const roles = data?.roles && typeof data.roles === 'object' ? data.roles : {};
      if (roles[uid]) return true;
    } catch {
      // try next
    }
  }
  return false;
}

async function r2GetBytes(key: string) {
  const res = await r2Fetch('GET', key);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`R2 read failed (${res.status})`);
  return {
    body: Buffer.from(await res.arrayBuffer()),
    contentType: res.headers.get('content-type') || 'application/octet-stream',
  };
}

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
    const allowed = await mailboxAllows(uid, key);
    if (!allowed) {
      json(res, 403, { error: 'Not allowed to read this file' });
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

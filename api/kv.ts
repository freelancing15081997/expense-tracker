import type { VercelRequest, VercelResponse } from '@vercel/node';

const FIREBASE_PROJECT = 'gen-lang-client-0616065043';
const FIRESTORE_DB = 'ai-studio-sharedsheetexpen-15aa5fbb-9604-4c59-b4a3-aa994442cb50';
const FIRESTORE_ROOT = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/${FIRESTORE_DB}/documents`;
const DOC_PREFIX = 'documents/';

function json(res: VercelResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
}

function postgresUrl() {
  const raw =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_PRISMA_URL ||
    '';
  if (!raw) return '';
  try {
    const url = new URL(raw);
    url.searchParams.delete('channel_binding');
    return url.toString();
  } catch {
    return raw;
  }
}

function blobAuth() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const storeId = process.env.BLOB_STORE_ID;
  return {
    ...(token ? { token } : {}),
    ...(storeId ? { storeId } : {}),
  };
}

function cleanPath(path: string) {
  const clean = path.replace(/^\/+|\/+$/g, '').replace(/\.\./g, '');
  if (!clean || !/^[a-zA-Z0-9_./-]+$/.test(clean)) throw new Error('Invalid path');
  return clean;
}

function blobKey(path: string) {
  return `${DOC_PREFIX}${cleanPath(path)}.json`;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { return null; }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function decodeValue(value: any): unknown {
  if (value == null || typeof value !== 'object') return value;
  if ('nullValue' in value) return null;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('stringValue' in value) return value.stringValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('bytesValue' in value) return value.bytesValue;
  if ('referenceValue' in value) return String(value.referenceValue).split('/documents/').pop() || value.referenceValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in value) {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value.mapValue.fields || {})) out[key] = decodeValue(val);
    return out;
  }
  return value;
}

function decodeDoc(raw: any) {
  const marker = '/documents/';
  const name = String(raw.name || '');
  const idx = name.indexOf(marker);
  const path = idx >= 0 ? name.slice(idx + marker.length) : '';
  const data: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(raw.fields || {})) data[key] = decodeValue(val);
  return { path, data };
}

async function firestoreGet(token: string, path: string) {
  const res = await fetch(`${FIRESTORE_ROOT}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return decodeDoc(await res.json()).data;
}

async function firestoreList(token: string, colPath: string) {
  const out: { id: string; data: Record<string, unknown> }[] = [];
  let pageToken = '';
  for (let i = 0; i < 20; i++) {
    const url = new URL(`${FIRESTORE_ROOT}/${colPath}`);
    url.searchParams.set('pageSize', '100');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) break;
    const payload = await res.json();
    for (const doc of payload.documents || []) {
      const decoded = decodeDoc(doc);
      const id = String(decoded.path.split('/').pop() || '');
      if (id) out.push({ id, data: decoded.data });
    }
    pageToken = payload.nextPageToken || '';
    if (!pageToken) break;
  }
  return out;
}

async function pgGet(path: string) {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(postgresUrl());
  await sql`CREATE TABLE IF NOT EXISTS documents (
    path TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  const p = cleanPath(path);
  const rows = await sql`SELECT data FROM documents WHERE path = ${p} LIMIT 1`;
  return rows[0] ? asObject(rows[0].data) : null;
}

async function pgSet(path: string, data: unknown) {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(postgresUrl());
  await sql`CREATE TABLE IF NOT EXISTS documents (
    path TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  const p = cleanPath(path);
  const payload = JSON.stringify(data ?? {});
  await sql`
    INSERT INTO documents (path, data, updated_at)
    VALUES (${p}, ${payload}::jsonb, NOW())
    ON CONFLICT (path) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
  `;
}

async function pgDel(path: string) {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(postgresUrl());
  const p = cleanPath(path);
  await sql`DELETE FROM documents WHERE path = ${p}`;
}

async function pgList(prefix: string) {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(postgresUrl());
  await sql`CREATE TABLE IF NOT EXISTS documents (
    path TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  const base = `${cleanPath(prefix)}/`;
  const rows = (await sql`SELECT path, data FROM documents WHERE path LIKE ${base + '%'}`) as { path: string; data: unknown }[];
  return rows
    .map((row) => {
      const rest = String(row.path).slice(base.length);
      const data = asObject(row.data);
      if (!rest || rest.includes('/') || !data) return null;
      return { id: rest, data };
    })
    .filter(Boolean) as { id: string; data: Record<string, unknown> }[];
}

async function blobGet(path: string) {
  const { get } = await import('@vercel/blob');
  const result = await get(blobKey(path), { access: 'private', useCache: false, ...blobAuth() });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  return asObject(JSON.parse(await new Response(result.stream).text()));
}

async function blobSet(path: string, data: unknown) {
  const { put } = await import('@vercel/blob');
  await put(blobKey(path), JSON.stringify(data ?? {}), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    ...blobAuth(),
  });
}

async function blobDel(path: string) {
  const { del } = await import('@vercel/blob');
  await del(blobKey(path), blobAuth());
}

async function blobList(prefix: string) {
  const { list } = await import('@vercel/blob');
  const base = `${DOC_PREFIX}${cleanPath(prefix)}/`;
  const out: { id: string; data: Record<string, unknown> }[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: base, cursor, limit: 1000, ...blobAuth() });
    for (const item of page.blobs) {
      if (!item.pathname.endsWith('.json')) continue;
      const rest = item.pathname.slice(base.length, -5);
      if (!rest || rest.includes('/')) continue;
      const data = await blobGet(`${cleanPath(prefix)}/${rest}`);
      if (data) out.push({ id: rest, data });
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out;
}

async function localGet(path: string) {
  if (postgresUrl()) return pgGet(path);
  return blobGet(path);
}

async function localSet(path: string, data: unknown) {
  if (postgresUrl()) return pgSet(path, data);
  return blobSet(path, data);
}

async function localDel(path: string) {
  if (postgresUrl()) return pgDel(path);
  return blobDel(path);
}

async function localList(prefix: string) {
  if (postgresUrl()) return pgList(prefix);
  return blobList(prefix);
}

async function readDoc(path: string, token: string) {
  try {
    const local = await localGet(path);
    if (local) return local;
  } catch {
    // Production often has no DATABASE_URL; Blob may also be missing.
  }
  return firestoreGet(token, path);
}

async function readList(path: string, token: string) {
  const byId = new Map<string, { id: string; data: Record<string, unknown> }>();
  try {
    for (const row of await localList(path)) byId.set(row.id, row);
  } catch {
    // Fall through to Firestore.
  }
  try {
    for (const row of await firestoreList(token, path)) {
      if (!byId.has(row.id)) byId.set(row.id, row);
    }
  } catch {
    // Ignore Firestore list failures.
  }
  return [...byId.values()];
}

function getAt(obj: any, field: string) {
  return field.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
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

    const { createRemoteJWKSet, jwtVerify } = await import('jose');
    const header = String(req.headers.authorization || '');
    const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
    if (!token) {
      json(res, 401, { error: 'Sign in required' });
      return;
    }
    await jwtVerify(token, createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')), {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT}`,
      audience: FIREBASE_PROJECT,
    });

    const rawBody = req.body;
    const body = typeof rawBody === 'string'
      ? JSON.parse(rawBody || '{}')
      : (rawBody && typeof rawBody === 'object' ? rawBody : {});
    const op = String(body.op || '');
    const path = String(body.path || '').replace(/^\/+|\/+$/g, '');
    if (!path && op !== 'list' && op !== 'query') {
      json(res, 400, { error: 'Missing path' });
      return;
    }

    if (op === 'get') {
      const data = await readDoc(path, token);
      json(res, 200, { exists: Boolean(data), id: path.split('/').pop(), data });
      return;
    }

    if (op === 'set') {
      const current = (await readDoc(path, token)) || {};
      const next = { ...((body.merge && typeof current === 'object') ? current : {}), ...(body.data || {}) };
      await localSet(path, next);
      json(res, 200, { ok: true, id: path.split('/').pop(), data: next });
      return;
    }

    if (op === 'update') {
      const current = (await readDoc(path, token)) || {};
      const next: Record<string, unknown> = { ...current };
      const patch = (body.data || {}) as Record<string, unknown>;
      for (const [key, value] of Object.entries(patch)) {
        if (key.includes('.')) {
          const parts = key.split('.');
          let cur: any = next;
          for (let i = 0; i < parts.length - 1; i++) {
            if (typeof cur[parts[i]] !== 'object' || !cur[parts[i]]) cur[parts[i]] = {};
            cur = cur[parts[i]];
          }
          cur[parts[parts.length - 1]] = value;
        } else {
          next[key] = value;
        }
      }
      await localSet(path, next);
      json(res, 200, { ok: true, data: next });
      return;
    }

    if (op === 'delete') {
      await localDel(path);
      json(res, 200, { ok: true });
      return;
    }

    if (op === 'add') {
      const id = Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      const data = { ...(body.data || {}), id };
      await localSet(`${path}/${id}`, data);
      json(res, 200, { id, data });
      return;
    }

    if (op === 'list' || op === 'query') {
      let docs = await readList(path, token);
      const constraints = Array.isArray(body.constraints) ? body.constraints : [];
      for (const c of constraints) {
        if (c.type === 'where' && c.op === '==') {
          docs = docs.filter((row) => getAt({ id: row.id, ...row.data }, c.field) === c.value);
        } else if (c.type === 'where' && c.op === 'in') {
          const allowed = Array.isArray(c.value) ? c.value : [];
          docs = docs.filter((row) => allowed.includes(getAt({ id: row.id, ...row.data }, c.field)));
        } else if (c.type === 'orderBy') {
          const dir = c.dir === 'desc' ? -1 : 1;
          docs.sort((a, b) => String(getAt(a.data, c.field) || '').localeCompare(String(getAt(b.data, c.field) || '')) * dir);
        } else if (c.type === 'limit') {
          docs = docs.slice(0, Number(c.n) || docs.length);
        }
      }
      json(res, 200, { docs });
      return;
    }

    json(res, 400, { error: 'Unknown op' });
  } catch (err: any) {
    json(res, 500, { error: err?.message || 'Data request failed' });
  }
}

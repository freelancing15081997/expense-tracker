import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

const PROJECT = 'gen-lang-client-0616065043';
const NAMED_DB = 'ai-studio-sharedsheetexpen-15aa5fbb-9604-4c59-b4a3-aa994442cb50';
const ROLES = ['owner', 'admin', 'contributor', 'viewer', 'auditor'];

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

function firestoreRoots() {
  return [
    `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/${NAMED_DB}/documents`,
    `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`,
  ];
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

function pathFromName(name: string) {
  const marker = '/documents/';
  const idx = name.indexOf(marker);
  return idx >= 0 ? name.slice(idx + marker.length) : '';
}

function decodeDoc(raw: any) {
  const path = pathFromName(String(raw.name || ''));
  const data: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(raw.fields || {})) data[key] = decodeValue(val);
  return { path, data };
}

async function fsFetch(token: string, url: string, init?: RequestInit) {
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init?.headers || {}),
    },
  });
}

async function listCollection(token: string, colPath: string) {
  const out: { path: string; data: Record<string, unknown> }[] = [];
  for (const root of firestoreRoots()) {
    let pageToken = '';
    for (let i = 0; i < 30; i++) {
      const url = new URL(`${root}/${colPath}`);
      url.searchParams.set('pageSize', '100');
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      const res = await fsFetch(token, url.toString());
      if (res.status === 403 || res.status === 404) break;
      if (!res.ok) break;
      const body = await res.json();
      for (const doc of body.documents || []) {
        const row = decodeDoc(doc);
        if (row.path) out.push(row);
      }
      pageToken = body.nextPageToken || '';
      if (!pageToken) break;
    }
    if (out.length) return out;
  }
  return out;
}

async function runQuery(token: string, parentPath: string, collectionId: string, filters: any[]) {
  const structuredQuery: any = { from: [{ collectionId }] };
  if (filters.length === 1) structuredQuery.where = filters[0];
  else if (filters.length > 1) structuredQuery.where = { compositeFilter: { op: 'AND', filters } };
  const out: { path: string; data: Record<string, unknown> }[] = [];
  for (const root of firestoreRoots()) {
    const url = parentPath ? `${root}/${parentPath}:runQuery` : `${root}:runQuery`;
    const res = await fsFetch(token, url, {
      method: 'POST',
      body: JSON.stringify({ structuredQuery }),
    });
    if (!res.ok) continue;
    const rows = await res.json();
    for (const row of Array.isArray(rows) ? rows : []) {
      if (!row?.document) continue;
      const doc = decodeDoc(row.document);
      if (doc.path) out.push(doc);
    }
    if (out.length) return out;
  }
  return out;
}

async function getDoc(token: string, path: string) {
  for (const root of firestoreRoots()) {
    const res = await fsFetch(token, `${root}/${path}`);
    if (res.status === 404 || res.status === 403) continue;
    if (!res.ok) continue;
    return decodeDoc(await res.json());
  }
  return null;
}

async function listBooks(token: string, uid: string) {
  const found = new Map<string, { path: string; data: Record<string, unknown> }>();
  const fromIn = await runQuery(token, '', 'books', [{
    fieldFilter: {
      field: { fieldPath: `roles.${uid}.role` },
      op: 'IN',
      value: { arrayValue: { values: ROLES.map((role) => ({ stringValue: role })) } },
    },
  }]);
  for (const row of fromIn) found.set(row.path, row);
  if (found.size) return [...found.values()];
  for (const role of ROLES) {
    const rows = await runQuery(token, '', 'books', [{
      fieldFilter: {
        field: { fieldPath: `roles.${uid}.role` },
        op: 'EQUAL',
        value: { stringValue: role },
      },
    }]);
    for (const row of rows) found.set(row.path, row);
  }
  return [...found.values()];
}

async function collect(token: string, uid: string, email: string) {
  const rows: { path: string; data: Record<string, unknown> }[] = [];
  const seen = new Set<string>();
  const add = (row: { path: string; data: Record<string, unknown> } | null) => {
    if (!row?.path || seen.has(row.path)) return;
    seen.add(row.path);
    rows.push(row);
  };

  add(await getDoc(token, `users/${uid}`));

  for (const book of await listBooks(token, uid)) {
    add(book);
    const bookId = book.path.split('/')[1];
    if (!bookId) continue;
    for (const col of ['expenses', 'inbound_events', 'email_events']) {
      for (const row of await listCollection(token, `books/${bookId}/${col}`)) add(row);
    }
  }

  if (email) {
    for (const row of await runQuery(token, '', 'invites', [{
      fieldFilter: {
        field: { fieldPath: 'email' },
        op: 'EQUAL',
        value: { stringValue: email },
      },
    }])) add(row);
  }

  for (const row of await runQuery(token, '', 'notifications', [{
    fieldFilter: {
      field: { fieldPath: 'userId' },
      op: 'EQUAL',
      value: { stringValue: uid },
    },
  }])) add(row);

  return rows;
}

async function upsertNeon(rows: { path: string; data: Record<string, unknown> }[]) {
  const url = postgresUrl();
  if (!url) throw new Error('DATABASE_URL / POSTGRES_URL is not set on the server');
  const sql = neon(url);
  await sql`CREATE TABLE IF NOT EXISTS documents (
    path TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS documents_path_idx ON documents (path)`;
  let copied = 0;
  const failed: string[] = [];
  for (const row of rows) {
    const path = String(row.path || '').replace(/^\/+|\/+$/g, '');
    if (!path || !/^[a-zA-Z0-9_./-]+$/.test(path)) continue;
    const payload = JSON.stringify(row.data ?? {});
    try {
      await sql`
        INSERT INTO documents (path, data, updated_at)
        VALUES (${path}, ${payload}::jsonb, NOW())
        ON CONFLICT (path) DO UPDATE SET
          data = EXCLUDED.data || documents.data,
          updated_at = NOW()
      `;
      copied += 1;
    } catch (err: any) {
      failed.push(`${path}: ${err?.message || 'write failed'}`);
    }
  }
  return { copied, failed };
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
    const jwks = createRemoteJWKSet(
      new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
    );
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `https://securetoken.google.com/${PROJECT}`,
      audience: PROJECT,
    });
    const uid = String(payload.user_id || payload.sub || '');
    const email = String(payload.email || '').trim().toLowerCase();
    if (!uid) {
      json(res, 401, { error: 'Sign in required' });
      return;
    }

    const rows = await collect(token, uid, email);
    const result = await upsertNeon(rows);
    json(res, 200, {
      copied: result.copied,
      skipped: false,
      documents: rows.length,
      failed: result.failed.slice(0, 8),
    });
  } catch (err: any) {
    json(res, 200, { copied: 0, skipped: true, error: err?.message || 'Copy failed' });
  }
}

export const config = { maxDuration: 60 };

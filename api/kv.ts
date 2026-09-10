import type { VercelRequest, VercelResponse } from '@vercel/node';
import { r2Del, r2GetJson, r2ListKeys, r2PutJson } from './_lib/r2';

const FIREBASE_PROJECT = 'gen-lang-client-0616065043';
const FIRESTORE_DB = 'ai-studio-sharedsheetexpen-15aa5fbb-9604-4c59-b4a3-aa994442cb50';
const FIRESTORE_ROOT = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/${FIRESTORE_DB}/documents`;
const DOC_PREFIX = 'documents/';

const jwtMem = new Map<string, { uid: string; exp: number }>();
let jwks: any = null;

async function uidFromToken(token: string) {
  const hit = jwtMem.get(token);
  if (hit && hit.exp > Date.now() + 5000) return hit.uid;
  const { createRemoteJWKSet, jwtVerify } = await import('jose');
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
  }
  const { payload } = await jwtVerify(token, jwks, {
    issuer: `https://securetoken.google.com/${FIREBASE_PROJECT}`,
    audience: FIREBASE_PROJECT,
  });
  const uid = String(payload.user_id || payload.sub || '');
  const exp = Number(payload.exp || 0) * 1000 || Date.now() + 50_000;
  if (uid) jwtMem.set(token, { uid, exp });
  if (jwtMem.size > 300) jwtMem.clear();
  return uid;
}

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

function encodeFsValue(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeFsValue) } };
  return { stringValue: String(value) };
}

function firestoreRoots() {
  return [
    FIRESTORE_ROOT,
    `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`,
  ];
}

async function firestoreGet(token: string, path: string) {
  for (const root of firestoreRoots()) {
    const res = await fetch(`${root}/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) return decodeDoc(await res.json()).data;
  }
  return null;
}

async function firestoreQuery(token: string, colPath: string, constraints: any[] = []) {
  const parts = colPath.split('/').filter(Boolean);
  const collectionId = parts.pop();
  if (!collectionId) return [];
  const parentPath = parts.join('/');
  const filters: any[] = [];
  const structuredQuery: any = { from: [{ collectionId }] };
  for (const c of constraints) {
    if (c.type === 'where' && c.op === '==') {
      filters.push({
        fieldFilter: {
          field: { fieldPath: c.field },
          op: 'EQUAL',
          value: encodeFsValue(c.value),
        },
      });
    } else if (c.type === 'where' && c.op === 'in') {
      filters.push({
        fieldFilter: {
          field: { fieldPath: c.field },
          op: 'IN',
          value: { arrayValue: { values: (Array.isArray(c.value) ? c.value : []).map(encodeFsValue) } },
        },
      });
    } else if (c.type === 'orderBy') {
      structuredQuery.orderBy = [{
        field: { fieldPath: c.field },
        direction: c.dir === 'desc' ? 'DESCENDING' : 'ASCENDING',
      }];
    } else if (c.type === 'limit') {
      structuredQuery.limit = Number(c.n) || 100;
    }
  }
  if (filters.length === 1) structuredQuery.where = filters[0];
  else if (filters.length > 1) structuredQuery.where = { compositeFilter: { op: 'AND', filters } };

  for (const root of firestoreRoots()) {
    const url = parentPath ? `${root}/${parentPath}:runQuery` : `${root}:runQuery`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ structuredQuery }),
    });
    if (!res.ok) continue;
    const rows = await res.json();
    if (!Array.isArray(rows)) continue;
    const out: { id: string; data: Record<string, unknown> }[] = [];
    for (const row of rows) {
      if (!row?.document) continue;
      const decoded = decodeDoc(row.document);
      const id = String(decoded.path.split('/').pop() || '');
      if (id) out.push({ id, data: decoded.data });
    }
    if (out.length || res.ok) return out;
  }
  return [];
}

let pgReady = false;

async function ensurePg() {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(postgresUrl());
  if (!pgReady) {
    await sql`CREATE TABLE IF NOT EXISTS documents (
      path TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
    pgReady = true;
  }
  return sql;
}

async function pgGet(path: string) {
  const sql = await ensurePg();
  const p = cleanPath(path);
  const rows = await sql`SELECT data FROM documents WHERE path = ${p} LIMIT 1`;
  return rows[0] ? asObject(rows[0].data) : null;
}

async function pgSet(path: string, data: unknown) {
  const sql = await ensurePg();
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
  const sql = await ensurePg();
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

const blobListCache = new Map<string, { at: number; rows: { id: string; data: Record<string, unknown> }[] }>();

function listPrefix(path: string) {
  const clean = cleanPath(path);
  const idx = clean.lastIndexOf('/');
  return idx === -1 ? '' : clean.slice(0, idx);
}

function touchBlobList(path: string, data: Record<string, unknown> | null) {
  const prefix = listPrefix(path);
  if (!prefix) return;
  const id = cleanPath(path).split('/').pop() || '';
  const hit = blobListCache.get(prefix);
  if (!hit) return;
  const rows = hit.rows.filter((row) => row.id !== id);
  if (data) rows.unshift({ id, data });
  blobListCache.set(prefix, { at: Date.now(), rows });
}

async function blobGet(path: string) {
  return asObject(await r2GetJson(blobKey(path)));
}

async function blobSet(path: string, data: unknown) {
  await r2PutJson(blobKey(path), data ?? {});
  const obj = asObject(data) || {};
  touchBlobList(path, obj);
}

async function blobDel(path: string) {
  await r2Del(blobKey(path));
  touchBlobList(path, null);
}

async function blobList(prefix: string) {
  const key = cleanPath(prefix);
  const cached = blobListCache.get(key);
  if (cached && Date.now() - cached.at < 20_000) return cached.rows;

  const base = `${DOC_PREFIX}${key}/`;
  const ids: string[] = [];
  for (const objectKey of await r2ListKeys(base)) {
    if (!objectKey.endsWith('.json')) continue;
    const rest = objectKey.slice(base.length, -5);
    if (!rest || rest.includes('/')) continue;
    ids.push(rest);
  }

  const out: { id: string; data: Record<string, unknown> }[] = [];
  const chunk = 32;
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk);
    const rows = await Promise.all(slice.map(async (id) => {
      const data = await blobGet(`${key}/${id}`);
      return data ? { id, data } : null;
    }));
    for (const row of rows) if (row) out.push(row);
  }
  blobListCache.set(key, { at: Date.now(), rows: out });
  return out;
}

async function rawGet(path: string) {
  if (postgresUrl()) return pgGet(path);
  return blobGet(path);
}

async function rawSet(path: string, data: unknown) {
  if (postgresUrl()) return pgSet(path, data);
  return blobSet(path, data);
}

async function rawDel(path: string) {
  if (postgresUrl()) return pgDel(path);
  return blobDel(path);
}

type WorkspaceSnap = {
  v: number;
  tenant: Record<string, unknown> | null;
  docs: Record<string, Record<string, unknown>>;
};

const SNAP_NAME = 'meta/pack';
const LEGACY_SNAP_NAME = '_snapshot';
const snapMem = new Map<string, { at: number; snap: WorkspaceSnap; dirty?: boolean }>();
const snapLocks = new Map<string, Promise<void>>();

function erpParts(path: string): { ws: string; rel: string } | null {
  if (!path.startsWith('erp_workspaces/')) return null;
  const bits = path.split('/').filter(Boolean);
  if (bits.length < 2) return null;
  const ws = bits[1];
  const rel = bits.slice(2).join('/');
  if (!rel || rel === SNAP_NAME || rel === LEGACY_SNAP_NAME) return null;
  return { ws, rel };
}

function emptySnap(): WorkspaceSnap {
  return { v: 1, tenant: null, docs: {} };
}

function snapPath(ws: string) {
  return `erp_workspaces/${ws}/${SNAP_NAME}`;
}

function listFromSnap(snap: WorkspaceSnap, colPath: string) {
  const bits = colPath.split('/').filter(Boolean);
  const prefix = `${bits.slice(2).join('/')}/`;
  if (prefix === '/') return [];
  const out: { id: string; data: Record<string, unknown> }[] = [];
  for (const [rel, data] of Object.entries(snap.docs)) {
    if (!rel.startsWith(prefix)) continue;
    const rest = rel.slice(prefix.length);
    if (!rest || rest.includes('/')) continue;
    out.push({ id: rest, data });
  }
  return out;
}

async function pgLoadWorkspace(ws: string): Promise<WorkspaceSnap> {
  const sql = await ensurePg();
  const prefix = `erp_workspaces/${ws}/`;
  const rows = (await sql`SELECT path, data FROM documents WHERE path LIKE ${prefix + '%'}`) as { path: string; data: unknown }[];
  const snap = emptySnap();
  for (const row of rows) {
    const rel = String(row.path).slice(prefix.length);
    if (!rel || rel === SNAP_NAME || rel === LEGACY_SNAP_NAME) continue;
    const data = asObject(row.data);
    if (!data) continue;
    if (rel === 'meta/tenant') snap.tenant = data;
    snap.docs[rel] = data;
  }
  return snap;
}

async function blobBuildWorkspace(ws: string): Promise<WorkspaceSnap> {
  const base = `${DOC_PREFIX}erp_workspaces/${ws}/`;
  const rels: string[] = [];
  for (const objectKey of await r2ListKeys(base)) {
    if (!objectKey.endsWith('.json')) continue;
    const rel = objectKey.slice(base.length, -5);
    if (!rel || rel === SNAP_NAME || rel === LEGACY_SNAP_NAME) continue;
    rels.push(rel);
  }
  const snap = emptySnap();
  for (let i = 0; i < rels.length; i += 24) {
    const slice = rels.slice(i, i + 24);
    const rows = await Promise.all(slice.map(async (rel) => {
      const data = await blobGet(`erp_workspaces/${ws}/${rel}`);
      return data ? { rel, data } : null;
    }));
    for (const row of rows) {
      if (!row) continue;
      if (row.rel === 'meta/tenant') snap.tenant = row.data;
      snap.docs[row.rel] = row.data;
    }
  }
  return snap;
}

async function loadSnap(ws: string): Promise<WorkspaceSnap> {
  const hit = snapMem.get(ws);
  if (hit && Date.now() - hit.at < 30_000) return hit.snap;
  if (postgresUrl()) {
    const snap = await pgLoadWorkspace(ws);
    snapMem.set(ws, { at: Date.now(), snap });
    return snap;
  }
  const stored = (asObject(await blobGet(snapPath(ws))) || asObject(await blobGet(`erp_workspaces/${ws}/${LEGACY_SNAP_NAME}`))) as WorkspaceSnap | null;
  if (stored && stored.docs && typeof stored.docs === 'object') {
    const snap: WorkspaceSnap = {
      v: Number(stored.v || 1),
      tenant: asObject(stored.tenant) || stored.tenant || null,
      docs: stored.docs as Record<string, Record<string, unknown>>,
    };
    snapMem.set(ws, { at: Date.now(), snap });
    return snap;
  }
  const built = await blobBuildWorkspace(ws);
  snapMem.set(ws, { at: Date.now(), snap: built });
  await blobSet(snapPath(ws), built).catch(() => undefined);
  return built;
}

async function persistSnap(ws: string, snap: WorkspaceSnap) {
  snap.v = (Number(snap.v) || 1) + 1;
  snapMem.set(ws, { at: Date.now(), snap });
  if (postgresUrl()) return;
  await blobSet(snapPath(ws), snap);
}

function writeSnapDoc(snap: WorkspaceSnap, rel: string, data: Record<string, unknown> | null) {
  if (data == null) {
    delete snap.docs[rel];
    if (rel === 'meta/tenant') snap.tenant = null;
    return;
  }
  snap.docs[rel] = data;
  if (rel === 'meta/tenant') snap.tenant = data;
}

async function withSnap(ws: string, fn: (snap: WorkspaceSnap) => void | Promise<void>) {
  const prev = snapLocks.get(ws) || Promise.resolve();
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const queued = prev.then(() => gate);
  snapLocks.set(ws, queued);
  await prev.catch(() => undefined);
  try {
    const snap = await loadSnap(ws);
    await fn(snap);
    await persistSnap(ws, snap);
  } finally {
    release();
    if (snapLocks.get(ws) === queued) snapLocks.delete(ws);
  }
}

async function localSetMany(writes: Array<{ path: string; data: Record<string, unknown> | null; merge?: boolean }>) {
  const byWs = new Map<string, typeof writes>();
  const other: typeof writes = [];
  for (const write of writes) {
    const parsed = erpParts(write.path);
    if (parsed) {
      const list = byWs.get(parsed.ws) || [];
      list.push(write);
      byWs.set(parsed.ws, list);
    } else other.push(write);
  }
  for (const [ws, rows] of byWs) {
    await withSnap(ws, async (snap) => {
      for (const write of rows) {
        const parsed = erpParts(write.path);
        if (!parsed) continue;
        if (write.data == null) {
          writeSnapDoc(snap, parsed.rel, null);
          if (postgresUrl()) await rawDel(write.path);
          continue;
        }
        const next = write.merge ? { ...(snap.docs[parsed.rel] || {}), ...write.data } : write.data;
        writeSnapDoc(snap, parsed.rel, next);
        if (postgresUrl()) await rawSet(write.path, next);
      }
    });
  }
  for (const write of other) {
    if (write.data == null) await rawDel(write.path);
    else await rawSet(write.path, write.data);
  }
}

async function localGet(path: string) {
  const parsed = erpParts(path);
  if (parsed) {
    const snap = await loadSnap(parsed.ws);
    if (Object.prototype.hasOwnProperty.call(snap.docs, parsed.rel)) return snap.docs[parsed.rel];
    if (parsed.rel === 'meta/tenant' && snap.tenant) return snap.tenant;
  }
  return rawGet(path);
}

async function localSet(path: string, data: unknown) {
  const obj = asObject(data) || {};
  const parsed = erpParts(path);
  if (parsed) {
    await withSnap(parsed.ws, (snap) => writeSnapDoc(snap, parsed.rel, obj));
    if (postgresUrl()) await rawSet(path, obj);
    return;
  }
  await rawSet(path, obj);
}

async function localDel(path: string) {
  const parsed = erpParts(path);
  if (parsed) {
    await withSnap(parsed.ws, (snap) => writeSnapDoc(snap, parsed.rel, null));
    if (postgresUrl()) await rawDel(path);
    return;
  }
  await rawDel(path);
}

async function localList(prefix: string) {
  const bits = prefix.split('/').filter(Boolean);
  if (bits[0] === 'erp_workspaces' && bits[1]) {
    const snap = await loadSnap(bits[1]);
    return listFromSnap(snap, prefix);
  }
  if (postgresUrl()) return pgList(prefix);
  return blobList(prefix);
}

function applyConstraints(docs: { id: string; data: Record<string, unknown> }[], constraints: any[] = []) {
  let next = docs;
  for (const c of constraints) {
    if (c.type === 'where' && c.op === '==') {
      next = next.filter((row) => getAt({ id: row.id, ...row.data }, c.field) === c.value);
    } else if (c.type === 'where' && c.op === 'in') {
      const allowed = Array.isArray(c.value) ? c.value : [];
      next = next.filter((row) => allowed.includes(getAt({ id: row.id, ...row.data }, c.field)));
    } else if (c.type === 'orderBy') {
      const dir = c.dir === 'desc' ? -1 : 1;
      next.sort((a, b) => String(getAt(a.data, c.field) || '').localeCompare(String(getAt(b.data, c.field) || '')) * dir);
    } else if (c.type === 'limit') {
      next = next.slice(0, Number(c.n) || next.length);
    }
  }
  return next;
}

function packCollections(snap: WorkspaceSnap) {
  const grouped: Record<string, { id: string; data: Record<string, unknown> }[]> = {};
  for (const [rel, data] of Object.entries(snap.docs)) {
    if (rel.includes('/')) {
      const col = rel.slice(0, rel.lastIndexOf('/'));
      const id = rel.slice(col.length + 1);
      if (!id || id.includes('/')) continue;
      (grouped[col] ||= []).push({ id, data });
    } else {
      (grouped[rel] ||= []).push({ id: rel, data });
    }
  }
  return grouped;
}

function isErpPath(path: string) {
  return path.startsWith('erp_workspaces/');
}

function ownsWorkspace(uid: string, workspaceId: string) {
  return Boolean(uid && workspaceId && (workspaceId === uid || workspaceId.startsWith(`${uid}_`)));
}

function assertErpAccess(uid: string, path: string) {
  if (!path || !isErpPath(path)) return;
  const workspaceId = path.split('/').filter(Boolean)[1] || '';
  if (!ownsWorkspace(uid, workspaceId)) {
    const err: Error & { status?: number } = new Error('Not allowed to access this Books workspace');
    err.status = 403;
    throw err;
  }
}

async function readDoc(path: string, token: string) {
  try {
    const local = await localGet(path);
    if (local) return local;
  } catch {
    // Production often has no DATABASE_URL; object store may also be empty.
  }
  if (isErpPath(path)) return null;
  return firestoreGet(token, path);
}

async function readList(path: string, token: string, constraints: any[] = []) {
  if (isErpPath(path)) {
    return localList(path).catch(() => [] as { id: string; data: Record<string, unknown> }[]);
  }
  const byId = new Map<string, { id: string; data: Record<string, unknown> }>();
  const localP = localList(path).catch(() => [] as { id: string; data: Record<string, unknown> }[]);
  const fsP = firestoreQuery(token, path, constraints).catch(() => [] as { id: string; data: Record<string, unknown> }[]);
  const [localRows, fsRows] = await Promise.all([localP, fsP]);
  for (const row of fsRows) byId.set(row.id, row);
  for (const row of localRows) byId.set(row.id, row);
  return [...byId.values()];
}

function getAt(obj: any, field: string) {
  return field.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

function applyPatch(current: Record<string, unknown>, patch: Record<string, unknown>) {
  const next: Record<string, unknown> = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (key.includes('.')) {
      const parts = key.split('.');
      let cur: any = next;
      for (let i = 0; i < parts.length - 1; i++) {
        const piece = cur[parts[i]];
        cur[parts[i]] = piece && typeof piece === 'object' && !Array.isArray(piece) ? { ...piece } : {};
        cur = cur[parts[i]];
      }
      cur[parts[parts.length - 1]] = value;
    } else {
      next[key] = value;
    }
  }
  return next;
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

    const header = String(req.headers.authorization || '');
    const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
    if (!token) {
      json(res, 401, { error: 'Sign in required' });
      return;
    }
    const uid = await uidFromToken(token);
    if (!uid) {
      json(res, 401, { error: 'Sign in required' });
      return;
    }

    const rawBody = req.body;
    const body = typeof rawBody === 'string'
      ? JSON.parse(rawBody || '{}')
      : (rawBody && typeof rawBody === 'object' ? rawBody : {});
    const op = String(body.op || '');
    const path = String(body.path || '').replace(/^\/+|\/+$/g, '');
    if (!path && op !== 'list' && op !== 'query' && op !== 'queryMany' && op !== 'batch' && op !== 'workspace') {
      json(res, 400, { error: 'Missing path' });
      return;
    }
    if (path) assertErpAccess(uid, path);

    if (op === 'workspace') {
      const bits = path.split('/').filter(Boolean);
      const ws = bits[0] === 'erp_workspaces' ? bits[1] : bits[0];
      if (!ws) {
        json(res, 400, { error: 'Missing workspace' });
        return;
      }
      assertErpAccess(uid, `erp_workspaces/${ws}`);
      const snap = await loadSnap(ws);
      json(res, 200, {
        tenant: snap.tenant || snap.docs['meta/tenant'] || null,
        collections: packCollections(snap),
      });
      return;
    }

    if (op === 'get') {
      const data = await readDoc(path, token);
      json(res, 200, { exists: Boolean(data), id: path.split('/').pop(), data });
      return;
    }

    if (op === 'set') {
      const incoming = (body.data || {}) as Record<string, unknown>;
      const next = body.merge
        ? { ...((await localGet(path).catch(() => null)) || {}), ...incoming }
        : incoming;
      await localSet(path, next);
      json(res, 200, { ok: true, id: path.split('/').pop(), data: next });
      return;
    }

    if (op === 'update') {
      const current = (await localGet(path).catch(() => null)) || {};
      const next = applyPatch(current, (body.data || {}) as Record<string, unknown>);
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
      const requested = String(body.id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48);
      const id = requested || Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      const data = { ...(body.data || {}), id };
      await localSet(`${path}/${id}`, data);
      json(res, 200, { id, data });
      return;
    }

    if (op === 'list' || op === 'query') {
      const constraints = Array.isArray(body.constraints) ? body.constraints : [];
      const docs = applyConstraints(await readList(path, token, constraints), constraints);
      json(res, 200, { docs });
      return;
    }

    if (op === 'batch') {
      const writes = Array.isArray(body.writes) ? body.writes.slice(0, 80) : [];
      const prepared: Array<{ path: string; data: Record<string, unknown> | null; merge?: boolean }> = [];
      for (const write of writes) {
        const writeOp = String(write.op || '');
        const writePath = String(write.path || '').replace(/^\/+|\/+$/g, '');
        if (!writePath) continue;
        assertErpAccess(uid, writePath);
        if (writeOp === 'set') {
          prepared.push({ path: writePath, data: (write.data || {}) as Record<string, unknown>, merge: Boolean(write.merge) });
        } else if (writeOp === 'update') {
          const current = (await localGet(writePath).catch(() => null)) || {};
          prepared.push({ path: writePath, data: applyPatch(current, (write.data || {}) as Record<string, unknown>) });
        }
      }
      await localSetMany(prepared);
      json(res, 200, { ok: true, count: prepared.length });
      return;
    }

    if (op === 'queryMany') {
      const queries = Array.isArray(body.queries) ? body.queries.slice(0, 24) : [];
      const parsed = queries.map((item: any) => {
        const qPath = String(item.path || '').replace(/^\/+|\/+$/g, '');
        return { qPath, constraints: Array.isArray(item.constraints) ? item.constraints : [] };
      });
      const wsIds = [...new Set(parsed.map((row: { qPath: string }) => {
        const bits = row.qPath.split('/').filter(Boolean);
        return bits[0] === 'erp_workspaces' ? bits[1] : '';
      }).filter(Boolean))];
      if (wsIds.length === 1 && parsed.every((row: { qPath: string }) => row.qPath.startsWith('erp_workspaces/'))) {
        const ws = String(wsIds[0] || '');
        if (!ws) {
          json(res, 400, { error: 'Missing workspace' });
          return;
        }
        assertErpAccess(uid, `erp_workspaces/${ws}`);
        const snap = await loadSnap(ws);
        const results = parsed.map((row: { qPath: string; constraints: any[] }) => ({
          path: row.qPath,
          docs: applyConstraints(listFromSnap(snap, row.qPath), row.constraints),
        }));
        json(res, 200, { results });
        return;
      }
      const results = await Promise.all(parsed.map(async (row: { qPath: string; constraints: any[] }) => {
        if (!row.qPath) return { path: row.qPath, docs: [] };
        assertErpAccess(uid, row.qPath);
        const docs = applyConstraints(await readList(row.qPath, token, row.constraints), row.constraints);
        return { path: row.qPath, docs };
      }));
      json(res, 200, { results });
      return;
    }

    json(res, 400, { error: 'Unknown op' });
  } catch (err: any) {
    json(res, err?.status === 403 ? 403 : 500, { error: err?.message || 'Data request failed' });
  }
}

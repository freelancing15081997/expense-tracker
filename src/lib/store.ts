import { isSoftDeleted } from './records';

export type Firestore = { vendor: 'neon' };
export const db: Firestore = { vendor: 'neon' };

export type DocRef = { path: string; id: string; kind?: 'doc' };
export type ColRef = { kind: 'col'; path: string };

const DELETE = { __delete: true };

export function deleteField() {
  return DELETE;
}

export function serverTimestamp() {
  return new Date().toISOString();
}

type Constraint =
  | { type: 'where'; field: string; op: string; value: unknown }
  | { type: 'limit'; n: number }
  | { type: 'orderBy'; field: string; dir?: string };

export function where(field: string, op: string, value: unknown): Constraint {
  return { type: 'where', field, op, value };
}
export function limit(n: number): Constraint {
  return { type: 'limit', n };
}
export function orderBy(field: string, dir?: string): Constraint {
  return { type: 'orderBy', field, dir };
}

export function newDocId() {
  const bytes = new Uint8Array(12);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

const DOC_TTL = 180_000;
const COL_TTL = 180_000;
const SESSION_KEY = 'byjan.store.v1';

function collectionTtl(path: string) {
  if (/\/inbound_events$/.test(path) || /\/email_events$/.test(path)) return 900;
  if (/\/expenses$/.test(path) || path === 'notifications') return 45_000;
  if (path === 'books' || path === 'invites') return 120_000;
  return COL_TTL;
}

const memory = new Map<string, { data: Record<string, unknown> | null; at: number; local?: boolean }>();
const colCache = new Map<string, { at: number; rows: Array<[string, Record<string, unknown>]> }>();
let cacheUid = '';

function persistCache() {
  if (typeof sessionStorage === 'undefined') return;
  try {
    const cols = [...colCache.entries()].slice(0, 48).map(([key, entry]) => [
      key,
      { at: entry.at, rows: entry.rows.slice(0, 400) },
    ]);
    const payload = JSON.stringify({ at: Date.now(), uid: cacheUid, cols });
    if (payload.length > 1_800_000) return;
    sessionStorage.setItem(SESSION_KEY, payload);
  } catch {
    // quota / private mode
  }
}

function restoreCache() {
  if (typeof sessionStorage === 'undefined') return;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { at?: number; uid?: string; cols?: Array<[string, { at: number; rows: Array<[string, Record<string, unknown>]> }]> };
    if (!parsed?.cols || Date.now() - Number(parsed.at || 0) > 30 * 60_000) return;
    cacheUid = String(parsed.uid || '');
    for (const [key, entry] of parsed.cols) {
      if (!entry?.rows) continue;
      colCache.set(key, { at: Number(entry.at) || Date.now(), rows: entry.rows });
      const colPath = String(key).split('::')[0];
      for (const [id, data] of entry.rows) remember(`${colPath}/${id}`, data);
    }
  } catch {
    // ignore corrupt cache
  }
}

export function collection(_db: Firestore, ...segments: string[]): ColRef {
  return { kind: 'col', path: segments.join('/') };
}

export function doc(first: Firestore | ColRef | { kind: 'col'; path: string }, ...segments: string[]): DocRef {
  if (first && typeof first === 'object' && 'kind' in first && first.kind === 'col') {
    const id = segments[0] || newDocId();
    return { kind: 'doc', path: `${first.path}/${id}`, id };
  }
  const path = segments.join('/');
  return { kind: 'doc', path, id: segments[segments.length - 1] || newDocId() };
}

export function query(col: { path: string }, ...constraints: Constraint[]) {
  return { path: col.path, constraints };
}

const pendingCalls = new Map<string, Promise<any>>();

async function call(body: Record<string, unknown>) {
  const op = String(body.op || '');
  const dedupe = op === 'get' || op === 'query' || op === 'queryMany';
  const key = dedupe ? JSON.stringify(body) : '';
  if (key && pendingCalls.has(key)) return pendingCalls.get(key);
  const run = (async () => {
    const { authHeaders } = await import('./auth-client');
    const res = await fetch('/api/kv', {
      method: 'POST',
      credentials: 'include',
      headers: await authHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify(body),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err: any = new Error(payload.error || `Data request failed (${res.status})`);
      err.code = res.status === 429 ? 'resource-exhausted' : 'failed';
      throw err;
    }
    return payload;
  })();
  if (key) {
    pendingCalls.set(key, run);
    run.finally(() => pendingCalls.delete(key));
  }
  return run;
}

function wrapDoc(id: string, data: any, path: string) {
  return {
    id,
    exists: () => Boolean(data),
    data: () => data,
    ref: { kind: 'doc' as const, path, id } satisfies DocRef,
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then((value) => {
      clearTimeout(timer);
      resolve(value);
    }).catch(() => {
      clearTimeout(timer);
      resolve(null);
    });
  });
}

function isErp(path: string) {
  return path.startsWith('erp_workspaces/');
}

function colKey(path: string, constraints?: Constraint[]) {
  return `${path}::${JSON.stringify(constraints || [])}`;
}

function remember(path: string, data: Record<string, unknown> | null, local = false) {
  memory.set(path, { data, at: Date.now(), local });
}

restoreCache();

export function clearStoreCache() {
  memory.clear();
  colCache.clear();
  cacheUid = '';
  if (typeof sessionStorage !== 'undefined') {
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
  }
}

export function setStoreUser(uid: string) {
  if (!uid) {
    clearStoreCache();
    return;
  }
  if (cacheUid && cacheUid !== uid) clearStoreCache();
  cacheUid = uid;
}

function bumpColCache(docPath: string, data: Record<string, unknown> | null) {
  const slash = docPath.lastIndexOf('/');
  if (slash < 0) return;
  const colPath = docPath.slice(0, slash);
  const id = docPath.slice(slash + 1);
  if (!id || id === '_snapshot') return;
  for (const [key, entry] of colCache) {
    if (key !== colPath && !key.startsWith(`${colPath}::`)) continue;
    const rows = new Map(entry.rows);
    if (data === null) rows.delete(id);
    else if (rowMatchesConstraints(id, data, constraintsFromColKey(key))) rows.set(id, data);
    else rows.delete(id);
    colCache.set(key, { at: Date.now(), rows: [...rows.entries()] });
  }
  persistCache();
}

function getAt(obj: any, field: string) {
  return field.split('.').reduce((acc: any, key: string) => (acc == null ? acc : acc[key]), obj);
}

function rowMatchesConstraints(id: string, data: Record<string, unknown>, constraints?: Constraint[]) {
  if (!constraints?.length) return true;
  const rec = { id, ...data };
  for (const c of constraints) {
    if (c.type === 'where' && c.op === '==') {
      if (getAt(rec, c.field) !== c.value) return false;
    } else if (c.type === 'where' && c.op === 'in') {
      const allowed = Array.isArray(c.value) ? c.value : [];
      if (!allowed.includes(getAt(rec, c.field))) return false;
    }
  }
  return true;
}

function constraintsFromColKey(key: string): Constraint[] {
  const idx = key.indexOf('::');
  if (idx < 0) return [];
  try {
    const parsed = JSON.parse(key.slice(idx + 2));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function filterMapByConstraints(
  byId: Map<string, Record<string, unknown>>,
  constraints?: Constraint[],
) {
  if (!constraints?.length) return byId;
  for (const [id, data] of [...byId]) {
    if (!rowMatchesConstraints(id, data, constraints)) byId.delete(id);
  }
  return byId;
}

function overlayCollection(colPath: string, byId: Map<string, Record<string, unknown>>) {
  const prefix = `${colPath}/`;
  for (const [path, entry] of memory) {
    if (!path.startsWith(prefix)) continue;
    const id = path.slice(prefix.length);
    if (!id || id.includes('/')) continue;
    if (entry.data === null || isSoftDeleted(entry.data)) {
      byId.delete(id);
      continue;
    }
    // Local writes win. Previously seen rows fill gaps when a later list is incomplete.
    // Never overwrite a row the server just returned — that hid live mail status.
    if (entry.local || !byId.has(id)) byId.set(id, entry.data);
  }
}

export type QuerySnapshot = {
  docs: { id: string; data: () => any; exists: () => boolean }[];
  empty: boolean;
  forEach: (fn: (doc: { id: string; data: () => any; exists: () => boolean }) => void) => void;
};

function asSnap(byId: Map<string, Record<string, unknown>>): QuerySnapshot {
  const docs = [...byId.entries()].map(([id, data]) => ({
    id,
    data: () => data,
    exists: () => Boolean(data),
  }));
  return {
    docs,
    empty: docs.length === 0,
    forEach: (fn) => docs.forEach(fn),
  };
}

function storeCollection(path: string, constraints: Constraint[] | undefined, byId: Map<string, Record<string, unknown>>) {
  const unconstrained = !(constraints && constraints.length);
  if (unconstrained) {
    const prev = colCache.get(colKey(path, constraints));
    if (prev && prev.rows.length > byId.size) {
      for (const [id, data] of prev.rows) {
        if (byId.has(id) || isSoftDeleted(data)) continue;
        const mem = memory.get(`${path}/${id}`);
        if (!mem || mem.data === null || isSoftDeleted(mem.data)) continue;
        byId.set(id, data);
      }
    }
  }
  for (const [id, data] of byId) remember(`${path}/${id}`, data);
  colCache.set(colKey(path, constraints), { at: Date.now(), rows: [...byId.entries()] });
  persistCache();
}

function fromCache(path: string, constraints?: Constraint[], allowStale = false) {
  const hit = colCache.get(colKey(path, constraints));
  if (!hit) return null;
  if (!allowStale && Date.now() - hit.at >= collectionTtl(path)) return null;
  const byId = new Map(hit.rows);
  overlayCollection(path, byId);
  filterMapByConstraints(byId, constraints);
  return asSnap(byId);
}

export async function getDoc(ref: DocRef) {
  const cached = memory.get(ref.path);
  if (cached && cached.data !== null && Date.now() - cached.at < DOC_TTL) {
    return wrapDoc(ref.id, cached.data, ref.path);
  }
  if (isErp(ref.path) && ref.path.includes('/idempotency/') && !cached) {
    remember(ref.path, null);
    return wrapDoc(ref.id, null, ref.path);
  }
  let data: Record<string, unknown> | null = cached?.data ?? null;
  const payload = await withTimeout(call({ op: 'get', path: ref.path }), data ? 1200 : defaultKvMs(ref.path));
  if (payload?.data) data = payload.data;
  if (payload) {
    remember(ref.path, data);
  } else if (data) {
    remember(ref.path, data);
  } else {
    const err: any = new Error('Books storage timed out. Retry.');
    err.code = 'unavailable';
    throw err;
  }
  return wrapDoc(ref.id, data, ref.path);
}

function applyPatch(current: Record<string, unknown>, patch: Record<string, unknown>) {
  const next: Record<string, unknown> = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (!key.includes('.')) {
      next[key] = value;
      continue;
    }
    const parts = key.split('.');
    let cur: Record<string, unknown> = next;
    for (let i = 0; i < parts.length - 1; i++) {
      const piece = cur[parts[i]];
      const clone = piece && typeof piece === 'object' && !Array.isArray(piece) ? { ...(piece as Record<string, unknown>) } : {};
      cur[parts[i]] = clone;
      cur = clone;
    }
    cur[parts[parts.length - 1]] = value;
  }
  return next;
}

export async function setDoc(ref: DocRef, data: Record<string, unknown>, opts?: { merge?: boolean }) {
  const next = opts?.merge ? { ...(memory.get(ref.path)?.data || {}), ...data } : data;
  remember(ref.path, next, true);
  bumpColCache(ref.path, next);
  await call({ op: 'set', path: ref.path, data, merge: Boolean(opts?.merge) });
}

export async function updateDoc(ref: DocRef, data: Record<string, unknown>) {
  const current = memory.get(ref.path)?.data || {};
  const optimistic = applyPatch(current, data);
  remember(ref.path, optimistic, true);
  bumpColCache(ref.path, optimistic);
  const payload = await call({ op: 'update', path: ref.path, data });
  const saved = payload?.data && typeof payload.data === 'object'
    ? payload.data as Record<string, unknown>
    : optimistic;
  remember(ref.path, saved, true);
  bumpColCache(ref.path, saved);
}

export async function addDoc(col: { path: string }, data: Record<string, unknown>) {
  const id = newDocId();
  const next = { ...data, id };
  remember(`${col.path}/${id}`, next, true);
  try {
    const payload = await call({ op: 'add', path: col.path, data: next, id });
    const realId = String(payload.id || id);
    const saved = payload?.data && typeof payload.data === 'object'
      ? { ...(payload.data as Record<string, unknown>), id: realId }
      : { ...data, id: realId };
    if (realId !== id) memory.delete(`${col.path}/${id}`);
    remember(`${col.path}/${realId}`, saved, true);
    bumpColCache(`${col.path}/${realId}`, saved);
    return { id: realId };
  } catch (err) {
    memory.delete(`${col.path}/${id}`);
    throw err;
  }
}

export async function deleteDoc(ref: DocRef) {
  remember(ref.path, null, true);
  bumpColCache(ref.path, null);
  await call({ op: 'delete', path: ref.path });
}

function defaultKvMs(path: string) {
  if (/\/inbound_events$/.test(path) || /\/email_events$/.test(path)) return 2500;
  if (path.startsWith('books') || path === 'notifications' || path === 'invites' || path.startsWith('inbound_')) {
    return 8000;
  }
  return 2500;
}

export async function getDocs(source: { path: string; constraints?: Constraint[] }, opts?: { kvMs?: number; force?: boolean }): Promise<QuerySnapshot> {
  if (!opts?.force) {
    const cached = fromCache(source.path, source.constraints);
    if (cached) return cached;
  }
  const byId = new Map<string, Record<string, unknown>>();
  const kvMs = opts?.kvMs ?? defaultKvMs(source.path);
  const payload = await withTimeout(call({ op: 'query', path: source.path, constraints: source.constraints || [] }), kvMs);
  for (const row of payload?.docs || []) {
    if (row?.id && row.data) byId.set(row.id, row.data);
  }
  overlayCollection(source.path, byId);
  if (payload == null) {
    const stale = colCache.get(colKey(source.path, source.constraints));
    if (stale) {
      for (const [id, data] of stale.rows) {
        if (!byId.has(id)) byId.set(id, data);
      }
    }
  }
  filterMapByConstraints(byId, source.constraints);
  if (payload != null || byId.size > 0) {
    storeCollection(source.path, source.constraints, byId);
  }
  return asSnap(byId);
}

export async function loadErpWorkspace(tenantId: string): Promise<{
  tenant: Record<string, unknown> | null;
  collections: Record<string, QuerySnapshot>;
} | null> {
  const payload = await call({ op: 'workspace', path: `erp_workspaces/${tenantId}` });
  if (!payload || (payload.tenant == null && !payload.collections)) return null;
  const collections: Record<string, QuerySnapshot> = {};
  for (const [name, rows] of Object.entries((payload.collections || {}) as Record<string, Array<{ id: string; data: Record<string, unknown> }>>)) {
    const byId = new Map<string, Record<string, unknown>>();
    for (const row of rows || []) {
      if (row?.id && row.data) byId.set(row.id, row.data);
    }
    const colPath = `erp_workspaces/${tenantId}/${name}`;
    overlayCollection(colPath, byId);
    storeCollection(colPath, undefined, byId);
    collections[name] = asSnap(byId);
  }
  const tenant = payload.tenant || null;
  if (tenant) remember(`erp_workspaces/${tenantId}/meta/tenant`, tenant);
  return { tenant, collections };
}

export async function getDocsMany(sources: Array<{ path: string; constraints?: Constraint[] }>): Promise<QuerySnapshot[]> {
  const cached = sources.map((source) => fromCache(source.path, source.constraints));
  if (cached.every(Boolean)) return cached as QuerySnapshot[];
  const missing = sources
    .map((source, index) => ({ source, index, hit: cached[index] }))
    .filter((row) => !row.hit);
  const payload = await call({
    op: 'queryMany',
    queries: missing.map((row) => ({ path: row.source.path, constraints: row.source.constraints || [] })),
  });
  const results = Array.isArray(payload?.results) ? payload.results : [];
  const byMissing = new Map<number, QuerySnapshot>();
  missing.forEach((row, i) => {
    const byId = new Map<string, Record<string, unknown>>();
    for (const docRow of results[i]?.docs || []) {
      if (docRow?.id && docRow.data) byId.set(docRow.id, docRow.data);
    }
    overlayCollection(row.source.path, byId);
    filterMapByConstraints(byId, row.source.constraints);
    storeCollection(row.source.path, row.source.constraints, byId);
    byMissing.set(row.index, asSnap(byId));
  });
  return sources.map((_, index) => cached[index] || byMissing.get(index)!);
}

export function onSnapshot(
  source: { path: string; constraints?: Constraint[]; kind?: string; id?: string },
  next: (snap: any) => void,
  error?: (err: any) => void,
) {
  let stopped = false;
  const mailLive = /\/inbound_events$/.test(source.path) || /\/email_events$/.test(source.path);
  const livePath = mailLive || /\/expenses$/.test(source.path) || source.path === 'notifications';
  const tick = (force = false) => {
    if (typeof document !== 'undefined' && document.hidden) return;
    if (source.kind === 'doc') {
      getDoc(source as DocRef).then((snap) => {
        if (!stopped) next(snap);
      }).catch((err) => {
        if (!stopped) error?.(err);
      });
      return;
    }
    const cached = fromCache(source.path, source.constraints, true);
    if (cached) next(cached);
    const fresh = fromCache(source.path, source.constraints, false);
    if (fresh && !force && !mailLive) return;
    getDocs(source, { kvMs: mailLive ? 2500 : 8000, force: force || mailLive }).then((snap) => {
      if (!stopped) next(snap);
    }).catch((err) => {
      if (!stopped) error?.(err);
    });
  };
  tick(true);
  const timer = setInterval(() => tick(false), mailLive ? 2500 : livePath ? 45_000 : 60_000);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

export type Transaction = {
  get: (ref: DocRef) => ReturnType<typeof getDoc>;
  set: (ref: DocRef, data: Record<string, unknown>) => void;
  update: (ref: DocRef, data: Record<string, unknown>) => void;
};

export async function runTransaction<T>(_db: Firestore, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  const overlay = new Map<string, Record<string, unknown>>();
  const writes: Array<{ op: 'set' | 'update'; path: string; data: Record<string, unknown> }> = [];
  const tx: Transaction = {
    get: async (ref) => {
      const cached = overlay.get(ref.path);
      if (cached) return wrapDoc(ref.id, cached, ref.path);
      const snap = await getDoc(ref);
      if (snap.exists()) overlay.set(ref.path, snap.data());
      return snap;
    },
    set: (ref, data) => {
      overlay.set(ref.path, data);
      writes.push({ op: 'set', path: ref.path, data });
    },
    update: (ref, data) => {
      const current = overlay.get(ref.path) || memory.get(ref.path)?.data || {};
      overlay.set(ref.path, applyPatch(current, data));
      writes.push({ op: 'update', path: ref.path, data });
    },
  };
  const result = await fn(tx);
  for (const write of writes) {
    const next = overlay.get(write.path) || write.data;
    remember(write.path, next, true);
    bumpColCache(write.path, next);
  }
  if (writes.length === 1) {
    await call(writes[0]);
  } else if (writes.length > 1) {
    await call({ op: 'batch', writes });
  }
  return result;
}

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

const FIRESTORE_DB = 'ai-studio-sharedsheetexpen-15aa5fbb-9604-4c59-b4a3-aa994442cb50';
let namedDb: any = null;

function pathParts(path: string) {
  return path.split('/').filter(Boolean);
}

async function firestoreDb() {
  if (namedDb) return namedDb;
  const { getFirestore } = await import('firebase/firestore');
  const { app } = await import('./firebase');
  namedDb = getFirestore(app, FIRESTORE_DB);
  return namedDb;
}

async function readFirestoreDoc(path: string) {
  const { doc, getDoc } = await import('firebase/firestore');
  const snap = await getDoc(doc(await firestoreDb(), ...pathParts(path)));
  return snap.exists() ? (snap.data() as Record<string, unknown>) : null;
}

async function readFirestoreDocs(path: string, constraints: Constraint[] = []) {
  const { collection, getDocs, query, where, limit, orderBy } = await import('firebase/firestore');
  const dbFs = await firestoreDb();
  const parts = pathParts(path);
  const col = (collection as any)(dbFs, ...parts);
  const parsed = constraints.map((c) => {
    if (c.type === 'where') return where(c.field, c.op as any, c.value);
    if (c.type === 'limit') return limit(c.n);
    return orderBy(c.field, (c.dir as 'asc' | 'desc') || 'asc');
  });
  const snap = parsed.length ? await getDocs((query as any)(col, ...parsed)) : await getDocs(col);
  return snap.docs.map((row) => ({ id: row.id, data: row.data() as Record<string, unknown> }));
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

const DOC_TTL = 120_000;
const COL_TTL = 120_000;
const LIVE_COL_TTL = 8_000;

function collectionTtl(path: string) {
  if (
    /\/expenses$/.test(path) ||
    /\/inbound_events$/.test(path) ||
    /\/email_events$/.test(path) ||
    path === 'notifications'
  ) {
    return LIVE_COL_TTL;
  }
  return COL_TTL;
}
const memory = new Map<string, { data: Record<string, unknown> | null; at: number }>();
const colCache = new Map<string, { at: number; rows: Array<[string, Record<string, unknown>]> }>();

function isErp(path: string) {
  return path.startsWith('erp_workspaces/');
}

function colKey(path: string, constraints?: Constraint[]) {
  return `${path}::${JSON.stringify(constraints || [])}`;
}

function remember(path: string, data: Record<string, unknown> | null) {
  memory.set(path, { data, at: Date.now() });
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
    else rows.set(id, data);
    colCache.set(key, { at: Date.now(), rows: [...rows.entries()] });
  }
}

function overlayCollection(colPath: string, byId: Map<string, Record<string, unknown>>) {
  const prefix = `${colPath}/`;
  for (const [path, entry] of memory) {
    if (!path.startsWith(prefix)) continue;
    const id = path.slice(prefix.length);
    if (!id || id.includes('/')) continue;
    if (entry.data === null) byId.delete(id);
    else byId.set(id, entry.data);
  }
}

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
  for (const [id, data] of byId) remember(`${path}/${id}`, data);
  colCache.set(colKey(path, constraints), { at: Date.now(), rows: [...byId.entries()] });
}

function fromCache(path: string, constraints?: Constraint[]) {
  const hit = colCache.get(colKey(path, constraints));
  if (!hit || Date.now() - hit.at >= collectionTtl(path)) return null;
  const byId = new Map(hit.rows);
  overlayCollection(path, byId);
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
  if (!isErp(ref.path)) {
    try {
      const fromFs = await readFirestoreDoc(ref.path);
      if (fromFs) data = fromFs;
    } catch {
      // Expense Tracker ledgers still live in the named Firestore database.
    }
  }
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

export async function setDoc(ref: DocRef, data: Record<string, unknown>, opts?: { merge?: boolean }) {
  const next = opts?.merge ? { ...(memory.get(ref.path)?.data || {}), ...data } : data;
  remember(ref.path, next);
  bumpColCache(ref.path, next);
  await call({ op: 'set', path: ref.path, data, merge: Boolean(opts?.merge) });
}

export async function updateDoc(ref: DocRef, data: Record<string, unknown>) {
  const next = { ...(memory.get(ref.path)?.data || {}), ...data };
  remember(ref.path, next);
  bumpColCache(ref.path, next);
  await call({ op: 'update', path: ref.path, data });
}

export async function addDoc(col: { path: string }, data: Record<string, unknown>) {
  const id = newDocId();
  const next = { ...data, id };
  remember(`${col.path}/${id}`, next);
  try {
    const payload = await call({ op: 'add', path: col.path, data: next, id });
    const realId = String(payload.id || id);
    if (realId !== id) {
      memory.delete(`${col.path}/${id}`);
      remember(`${col.path}/${realId}`, { ...data, id: realId });
    }
    return { id: realId };
  } catch (err) {
    memory.delete(`${col.path}/${id}`);
    throw err;
  }
}

export async function deleteDoc(ref: DocRef) {
  remember(ref.path, null);
  bumpColCache(ref.path, null);
  await call({ op: 'delete', path: ref.path });
}

export type QuerySnapshot = {
  docs: { id: string; data: () => any; exists: () => boolean }[];
  empty: boolean;
  forEach: (fn: (doc: { id: string; data: () => any; exists: () => boolean }) => void) => void;
};

function defaultKvMs(path: string) {
  // Ledger/books lists hit R2 key listing; 800ms often returned empty and hid real rows.
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
  const kvPromise = withTimeout(call({ op: 'query', path: source.path, constraints: source.constraints || [] }), kvMs);
  if (!isErp(source.path)) {
    try {
      for (const row of await readFirestoreDocs(source.path, source.constraints || [])) {
        byId.set(row.id, row.data);
      }
    } catch {
      // Rules require a roles.{uid} query on books; Firestore client sends it.
    }
  }
  overlayCollection(source.path, byId);
  const payload = await kvPromise;
  for (const row of payload?.docs || []) {
    if (row?.id && row.data) byId.set(row.id, row.data);
  }
  overlayCollection(source.path, byId);
  // Do not cache empty results when KV timed out — that hides R2-only expenses for 120s.
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
  const livePath =
    /\/expenses$/.test(source.path) ||
    /\/inbound_events$/.test(source.path) ||
    /\/email_events$/.test(source.path) ||
    source.path === 'notifications';
  const tick = () => {
    if (typeof document !== 'undefined' && document.hidden) return;
    if (source.kind === 'doc') {
      getDoc(source as DocRef).then((snap) => {
        if (!stopped) next(snap);
      }).catch((err) => {
        if (!stopped) error?.(err);
      });
      return;
    }
    getDocs(source, livePath ? { force: true, kvMs: 8000 } : undefined).then((snap) => {
      if (!stopped) next(snap);
    }).catch((err) => {
      if (!stopped) error?.(err);
    });
  };
  tick();
  const timer = setInterval(tick, livePath ? 8000 : 25000);
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
      const current = overlay.get(ref.path) || {};
      overlay.set(ref.path, { ...current, ...data });
      writes.push({ op: 'update', path: ref.path, data });
    },
  };
  const result = await fn(tx);
  for (const write of writes) {
    const next = overlay.get(write.path) || write.data;
    remember(write.path, next);
    bumpColCache(write.path, next);
  }
  if (writes.length === 1) {
    await call(writes[0]);
  } else if (writes.length > 1) {
    await call({ op: 'batch', writes });
  }
  return result;
}

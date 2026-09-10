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

function autoId() {
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
  const col = collection(await firestoreDb(), ...pathParts(path));
  const parsed = constraints.map((c) => {
    if (c.type === 'where') return where(c.field, c.op as any, c.value);
    if (c.type === 'limit') return limit(c.n);
    return orderBy(c.field, (c.dir as 'asc' | 'desc') || 'asc');
  });
  const snap = parsed.length ? await getDocs(query(col, ...parsed)) : await getDocs(col);
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
    const id = segments[0] || autoId();
    return { kind: 'doc', path: `${first.path}/${id}`, id };
  }
  const path = segments.join('/');
  return { kind: 'doc', path, id: segments[segments.length - 1] || autoId() };
}

export function query(col: { path: string }, ...constraints: Constraint[]) {
  return { path: col.path, constraints };
}

async function call(body: Record<string, unknown>) {
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
}

function wrapDoc(id: string, data: any, path: string) {
  return {
    id,
    exists: () => Boolean(data),
    data: () => data,
    ref: { kind: 'doc' as const, path, id } satisfies DocRef,
  };
}

const memory = new Map<string, { data: Record<string, unknown> | null; at: number }>();

function remember(path: string, data: Record<string, unknown> | null) {
  memory.set(path, { data, at: Date.now() });
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

export async function getDoc(ref: DocRef) {
  const cached = memory.get(ref.path);
  if (cached && Date.now() - cached.at < 8000) {
    return wrapDoc(ref.id, cached.data, ref.path);
  }
  let data: Record<string, unknown> | null = cached?.data ?? null;
  try {
    data = await readFirestoreDoc(ref.path);
  } catch {
    // Named Firestore holds existing ledgers.
  }
  const payload = await withTimeout(call({ op: 'get', path: ref.path }), data ? 450 : 900);
  if (payload?.data) data = payload.data;
  return wrapDoc(ref.id, data, ref.path);
}

export async function setDoc(ref: DocRef, data: Record<string, unknown>, opts?: { merge?: boolean }) {
  const next = opts?.merge ? { ...(memory.get(ref.path)?.data || {}), ...data } : data;
  remember(ref.path, next);
  await call({ op: 'set', path: ref.path, data, merge: Boolean(opts?.merge) });
}

export async function updateDoc(ref: DocRef, data: Record<string, unknown>) {
  remember(ref.path, { ...(memory.get(ref.path)?.data || {}), ...data });
  await call({ op: 'update', path: ref.path, data });
}

export async function addDoc(col: { path: string }, data: Record<string, unknown>) {
  const id = autoId();
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
  await call({ op: 'delete', path: ref.path });
}

export type QuerySnapshot = {
  docs: { id: string; data: () => any; exists: () => boolean }[];
  empty: boolean;
  forEach: (fn: (doc: { id: string; data: () => any; exists: () => boolean }) => void) => void;
};

export async function getDocs(source: { path: string; constraints?: Constraint[] }): Promise<QuerySnapshot> {
  const byId = new Map<string, Record<string, unknown>>();
  const kv = withTimeout(call({ op: 'query', path: source.path, constraints: source.constraints || [] }), 850);
  try {
    for (const row of await readFirestoreDocs(source.path, source.constraints || [])) {
      byId.set(row.id, row.data);
    }
  } catch {
    // Rules require a roles.{uid} query on books; Firestore client sends it.
  }
  overlayCollection(source.path, byId);
  const payload = await kv;
  for (const row of payload?.docs || []) {
    if (row?.id && row.data) byId.set(row.id, row.data);
  }
  overlayCollection(source.path, byId);
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

export function onSnapshot(
  source: { path: string; constraints?: Constraint[]; kind?: string; id?: string },
  next: (snap: any) => void,
  error?: (err: any) => void,
) {
  let stopped = false;
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
    getDocs(source).then((snap) => {
      if (!stopped) next(snap);
    }).catch((err) => {
      if (!stopped) error?.(err);
    });
  };
  tick();
  const timer = setInterval(tick, 25000);
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
    await call(write);
  }
  return result;
}

export type Firestore = { vendor: 'vercel' };
export const db: Firestore = { vendor: 'vercel' };

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
    const err: any = new Error(payload.error || 'Data request failed');
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

export async function getDoc(ref: DocRef) {
  const payload = await call({ op: 'get', path: ref.path });
  return wrapDoc(ref.id, payload.data, ref.path);
}

export async function setDoc(ref: DocRef, data: Record<string, unknown>, opts?: { merge?: boolean }) {
  await call({ op: 'set', path: ref.path, data, merge: Boolean(opts?.merge) });
}

export async function updateDoc(ref: DocRef, data: Record<string, unknown>) {
  await call({ op: 'update', path: ref.path, data });
}

export async function addDoc(col: { path: string }, data: Record<string, unknown>) {
  const payload = await call({ op: 'add', path: col.path, data });
  return { id: payload.id as string };
}

export async function deleteDoc(ref: DocRef) {
  await call({ op: 'delete', path: ref.path });
}

export type QuerySnapshot = {
  docs: { id: string; data: () => any; exists: () => boolean }[];
  empty: boolean;
  forEach: (fn: (doc: { id: string; data: () => any; exists: () => boolean }) => void) => void;
};

export async function getDocs(source: { path: string; constraints?: Constraint[] }): Promise<QuerySnapshot> {
  const payload = await call({ op: 'query', path: source.path, constraints: source.constraints || [] });
  const docs = (payload.docs || []).map((row: any) => ({
    id: row.id,
    data: () => row.data,
    exists: () => Boolean(row.data),
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
  const timer = setInterval(tick, 8000);
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

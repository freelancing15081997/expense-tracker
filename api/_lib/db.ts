import { neon } from '@neondatabase/serverless';
import { r2Del, r2GetJson, r2ListKeys, r2PutJson } from './r2';

const DOC_PREFIX = 'documents/';

function readPostgresUrl() {
  const raw =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_PRISMA_URL;
  if (!raw) return '';
  try {
    const url = new URL(raw);
    url.searchParams.delete('channel_binding');
    return url.toString();
  } catch {
    return raw;
  }
}

let sql: ReturnType<typeof neon> | null = null;
function getSql() {
  const url = readPostgresUrl();
  if (!url) throw new Error('Postgres is not configured. Set DATABASE_URL or POSTGRES_URL.');
  if (!sql) sql = neon(url);
  return sql;
}

function cleanPath(path: string) {
  const clean = path.replace(/^\/+|\/+$/g, '').replace(/\.\./g, '');
  if (!clean || !/^[a-zA-Z0-9_./-]+$/.test(clean)) throw new Error('Invalid path');
  return clean;
}

function blobKey(path: string) {
  return `${DOC_PREFIX}${cleanPath(path)}.json`;
}

let schemaReady: Promise<void> | null = null;
function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const db = getSql();
      await db`CREATE TABLE IF NOT EXISTS documents (
        path TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await db`CREATE INDEX IF NOT EXISTS documents_path_idx ON documents (path)`;
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

async function blobGet(path: string): Promise<Record<string, unknown> | null> {
  return asObject(await r2GetJson(blobKey(path)));
}

async function blobSet(path: string, data: unknown) {
  await r2PutJson(blobKey(path), data ?? {});
}

async function blobDel(path: string) {
  await r2Del(blobKey(path));
}

async function blobListKeys(prefix: string) {
  return r2ListKeys(prefix);
}

export async function kvGet(path: string): Promise<Record<string, unknown> | null> {
  if (readPostgresUrl()) {
    await ensureSchema();
    const db = getSql();
    const p = cleanPath(path);
    const rows = await db`SELECT data FROM documents WHERE path = ${p} LIMIT 1`;
    return rows[0] ? asObject(rows[0].data) : null;
  }
  return blobGet(path);
}

export async function kvSet(path: string, data: unknown) {
  if (readPostgresUrl()) {
    await ensureSchema();
    const db = getSql();
    const p = cleanPath(path);
    const payload = JSON.stringify(data ?? {});
    await db`
      INSERT INTO documents (path, data, updated_at)
      VALUES (${p}, ${payload}::jsonb, NOW())
      ON CONFLICT (path) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
    `;
    return;
  }
  await blobSet(path, data);
}

export async function kvDel(path: string) {
  if (readPostgresUrl()) {
    await ensureSchema();
    const db = getSql();
    const p = cleanPath(path);
    await db`DELETE FROM documents WHERE path = ${p}`;
    return;
  }
  await blobDel(path);
}

export async function kvList(prefix: string) {
  if (readPostgresUrl()) {
    await ensureSchema();
    const db = getSql();
    const base = `${cleanPath(prefix)}/`;
    const rows = (await db`
      SELECT path, data FROM documents
      WHERE path LIKE ${base + '%'}
    `) as { path: string; data: unknown }[];
    const out: { id: string; data: Record<string, unknown> }[] = [];
    for (const row of rows) {
      const rest = String(row.path).slice(base.length);
      if (!rest || rest.includes('/')) continue;
      const data = asObject(row.data);
      if (!data) continue;
      out.push({ id: rest, data });
    }
    return out;
  }
  const base = `${DOC_PREFIX}${cleanPath(prefix)}/`;
  const out: { id: string; data: Record<string, unknown> }[] = [];
  for (const key of await blobListKeys(base)) {
    if (!key.endsWith('.json')) continue;
    const rest = key.slice(base.length, -5);
    if (!rest || rest.includes('/')) continue;
    const data = await blobGet(`${cleanPath(prefix)}/${rest}`);
    if (data) out.push({ id: rest, data });
  }
  return out;
}

export async function kvListPrefix(prefix: string) {
  if (readPostgresUrl()) {
    await ensureSchema();
    const db = getSql();
    const p = cleanPath(prefix);
    const child = `${p}/`;
    const rows = (await db`
      SELECT path, data FROM documents
      WHERE path = ${p} OR path LIKE ${child + '%'}
    `) as { path: string; data: unknown }[];
    const out: { path: string; data: Record<string, unknown> }[] = [];
    for (const row of rows) {
      const data = asObject(row.data);
      if (!data) continue;
      out.push({ path: String(row.path), data });
    }
    return out;
  }
  const p = cleanPath(prefix);
  const out: { path: string; data: Record<string, unknown> }[] = [];
  const self = await blobGet(p);
  if (self) out.push({ path: p, data: self });
  for (const key of await blobListKeys(`${DOC_PREFIX}${p}/`)) {
    if (!key.endsWith('.json')) continue;
    const path = key.slice(DOC_PREFIX.length, -5);
    const data = await blobGet(path);
    if (data) out.push({ path, data });
  }
  return out;
}

import { neon } from '@neondatabase/serverless';

function postgresUrl() {
  const raw =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_PRISMA_URL;
  if (!raw) throw new Error('Postgres is not configured. Set DATABASE_URL or POSTGRES_URL.');
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
  if (!sql) sql = neon(postgresUrl());
  return sql;
}

function cleanPath(path: string) {
  const clean = path.replace(/^\/+|\/+$/g, '').replace(/\.\./g, '');
  if (!clean || !/^[a-zA-Z0-9_./-]+$/.test(clean)) throw new Error('Invalid path');
  return clean;
}

let schemaReady: Promise<void> | null = null;
export function ensureSchema() {
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

export async function kvGet(path: string): Promise<Record<string, unknown> | null> {
  await ensureSchema();
  const db = getSql();
  const p = cleanPath(path);
  const rows = await db`SELECT data FROM documents WHERE path = ${p} LIMIT 1`;
  return rows[0] ? asObject(rows[0].data) : null;
}

export async function kvSet(path: string, data: unknown) {
  await ensureSchema();
  const db = getSql();
  const p = cleanPath(path);
  const payload = JSON.stringify(data ?? {});
  await db`
    INSERT INTO documents (path, data, updated_at)
    VALUES (${p}, ${payload}::jsonb, NOW())
    ON CONFLICT (path) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
  `;
}

export async function kvDel(path: string) {
  await ensureSchema();
  const db = getSql();
  const p = cleanPath(path);
  await db`DELETE FROM documents WHERE path = ${p}`;
}

export async function kvList(prefix: string) {
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

export async function kvListPrefix(prefix: string) {
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

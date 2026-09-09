import type { VercelRequest, VercelResponse } from '@vercel/node';

function json(res: VercelResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
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

    const { neon } = await import('@neondatabase/serverless');
    const { createRemoteJWKSet, jwtVerify } = await import('jose');

    const rawUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
    if (!rawUrl) {
      json(res, 500, { error: 'Postgres is not configured. Set DATABASE_URL on Vercel.' });
      return;
    }
    let connectionString = rawUrl;
    try {
      const parsed = new URL(rawUrl);
      parsed.searchParams.delete('channel_binding');
      connectionString = parsed.toString();
    } catch {
      connectionString = rawUrl;
    }

    const sql = neon(connectionString);
    await sql`CREATE TABLE IF NOT EXISTS documents (
      path TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS documents_path_idx ON documents (path)`;

    const header = String(req.headers.authorization || '');
    const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
    if (!token) {
      json(res, 401, { error: 'Sign in required' });
      return;
    }
    const jwks = createRemoteJWKSet(
      new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
    );
    await jwtVerify(token, jwks, {
      issuer: 'https://securetoken.google.com/gen-lang-client-0616065043',
      audience: 'gen-lang-client-0616065043',
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
    const clean = path.replace(/\.\./g, '');
    if (path && !/^[a-zA-Z0-9_./-]+$/.test(clean)) {
      json(res, 400, { error: 'Invalid path' });
      return;
    }

    const asObject = (value: unknown) => {
      if (typeof value === 'string') {
        try { value = JSON.parse(value); } catch { return null; }
      }
      if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
      return value as Record<string, unknown>;
    };

    if (op === 'get') {
      const rows = await sql`SELECT data FROM documents WHERE path = ${clean} LIMIT 1`;
      json(res, 200, { exists: Boolean(rows[0]), id: clean.split('/').pop(), data: rows[0] ? asObject(rows[0].data) : null });
      return;
    }

    if (op === 'set') {
      const currentRows = await sql`SELECT data FROM documents WHERE path = ${clean} LIMIT 1`;
      const current = currentRows[0] ? asObject(currentRows[0].data) || {} : {};
      const next = { ...((body.merge && typeof current === 'object') ? current : {}), ...(body.data || {}) };
      const payload = JSON.stringify(next ?? {});
      await sql`
        INSERT INTO documents (path, data, updated_at)
        VALUES (${clean}, ${payload}::jsonb, NOW())
        ON CONFLICT (path) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
      `;
      json(res, 200, { ok: true, id: clean.split('/').pop(), data: next });
      return;
    }

    if (op === 'update') {
      const currentRows = await sql`SELECT data FROM documents WHERE path = ${clean} LIMIT 1`;
      const current = currentRows[0] ? asObject(currentRows[0].data) || {} : {};
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
      const payload = JSON.stringify(next);
      await sql`
        INSERT INTO documents (path, data, updated_at)
        VALUES (${clean}, ${payload}::jsonb, NOW())
        ON CONFLICT (path) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
      `;
      json(res, 200, { ok: true, data: next });
      return;
    }

    if (op === 'delete') {
      await sql`DELETE FROM documents WHERE path = ${clean}`;
      json(res, 200, { ok: true });
      return;
    }

    if (op === 'add') {
      const id = Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      const data = { ...(body.data || {}), id };
      const payload = JSON.stringify(data);
      const full = `${clean}/${id}`;
      await sql`
        INSERT INTO documents (path, data, updated_at)
        VALUES (${full}, ${payload}::jsonb, NOW())
        ON CONFLICT (path) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
      `;
      json(res, 200, { id, data });
      return;
    }

    if (op === 'list' || op === 'query') {
      const base = `${clean}/`;
      const rows = (await sql`
        SELECT path, data FROM documents WHERE path LIKE ${base + '%'}
      `) as { path: string; data: unknown }[];
      let docs = rows
        .map((row) => {
          const rest = String(row.path).slice(base.length);
          const data = asObject(row.data);
          if (!rest || rest.includes('/') || !data) return null;
          return { id: rest, data };
        })
        .filter(Boolean) as { id: string; data: Record<string, unknown> }[];

      const getAt = (obj: any, field: string) => field.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
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

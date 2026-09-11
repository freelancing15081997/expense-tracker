import { neon } from '@neondatabase/serverless';
import { randomBytes } from 'node:crypto';

type Sql = {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<Record<string, unknown>[]>;
};

function asRows<T extends Record<string, unknown> = Record<string, unknown>>(result: unknown): T[] {
  return Array.isArray(result) ? (result as T[]) : [];
}

export function postgresUrl() {
  const raw =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.BYJAN_NEON_DATABASE_URL ||
    process.env.BYJAN_NEON_POSTGRES_URL ||
    process.env.BYJAN_NEON_DATABASE_URL_UNPOOLED ||
    process.env.BYJAN_NEON_POSTGRES_URL_NON_POOLING ||
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

export function cleanPath(path: string) {
  const clean = path.replace(/^\/+|\/+$/g, '').replace(/\.\./g, '');
  // Invite docs are stored as invites/{bookId}_{email}, so @ and + must be allowed.
  if (!clean || !/^[a-zA-Z0-9_./@+-]+$/.test(clean)) throw new Error('Invalid path');
  return clean;
}

export function asObject(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { return null; }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

let sqlMem: Sql | null = null;
let schemaReady = false;

export async function getLedgerSql() {
  const url = postgresUrl();
  if (!url) throw new Error('Postgres is not configured');
  if (!sqlMem) sqlMem = neon(url) as unknown as Sql;
  if (!schemaReady) {
    await ensureLedgerSchema(sqlMem);
    schemaReady = true;
  }
  return sqlMem;
}

function num(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function text(value: unknown) {
  return value == null ? '' : String(value);
}

function ts(value: unknown) {
  if (typeof value === 'string' && value && !Number.isNaN(Date.parse(value))) return value;
  return null;
}

function flag(data: Record<string, unknown>) {
  const deleted = data.deleted;
  return deleted === true || deleted === 'true' || deleted === 1 || deleted === '1' || Boolean(data.deletedAt) || data.status === 'deleted';
}

const INBOUND_DOMAIN = 'easypado.com';
const RESERVED_INBOUND_LOCALS = new Set([
  'support', 'info', 'noreply', 'no-reply', 'admin', 'welcome',
  'byjanbooks', 'hello', 'contact', 'mail', 'email',
]);

export function inboundMailboxSlug(name: string) {
  const slug = String(name || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return slug || 'ledger';
}

function inboundAddressFor(slug: string) {
  return `${inboundMailboxSlug(slug)}@${INBOUND_DOMAIN}`;
}

function shortBookId(bookId: string) {
  return String(bookId || '').replace(/[^a-zA-Z0-9]/g, '').slice(-6).toLowerCase() || 'book';
}

function rolesOf(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export async function ledgerEnsureMailbox(bookId: string, data: Record<string, unknown> = {}) {
  const id = String(bookId || '').trim();
  if (!id) return null;
  const obj = asObject(data) || {};
  const current = asObject(await ledgerGet(`inbound_mailboxes/${id}`)) || {};
  const existingSlug = inboundMailboxSlug(text(current.slug));
  if (existingSlug && text(current.address)) {
    const record = {
      bookId: id,
      name: text(obj.name || current.name) || 'Ledger',
      currency: text(obj.currency || current.currency) || 'INR',
      ownerId: text(obj.ownerId || current.ownerId),
      roles: Object.keys(rolesOf(obj.roles)).length ? rolesOf(obj.roles) : rolesOf(current.roles),
      slug: existingSlug,
      address: text(current.address) || inboundAddressFor(existingSlug),
      updatedAt: text(current.updatedAt) || new Date().toISOString(),
    };
    if (text(obj.inboundAddress) !== record.address || text(obj.inboundSlug) !== record.slug) {
      await stampBookMailbox(id, record).catch(() => undefined);
    }
    return record;
  }

  const name = text(obj.name || current.name) || 'Ledger';
  const preferred = inboundMailboxSlug(name);
  const start = RESERVED_INBOUND_LOCALS.has(preferred) ? `${preferred}-ledger` : preferred;
  const candidates: string[] = [];
  const seen = new Set<string>();
  for (const candidate of [start, ...Array.from({ length: 19 }, (_, i) => `${start}-${i + 2}`), `${start}-${shortBookId(id)}`]) {
    const slug = inboundMailboxSlug(candidate);
    if (!slug || seen.has(slug) || RESERVED_INBOUND_LOCALS.has(slug)) continue;
    seen.add(slug);
    candidates.push(slug);
  }
  if (!candidates.length) return null;

  const sql = await getLedgerSql();
  const takenRows = asRows<{ slug: string; book_id: string }>(
    await sql`SELECT slug, data->>'bookId' AS book_id FROM inbound_aliases WHERE slug = ANY(${candidates})`,
  );
  const taken = new Map(takenRows.map((row) => [text(row.slug), text(row.book_id)]));

  for (const slug of candidates) {
    const owner = taken.get(slug) || '';
    if (owner && owner !== id) continue;
    const record = {
      bookId: id,
      name,
      currency: text(obj.currency || current.currency) || 'INR',
      ownerId: text(obj.ownerId || current.ownerId),
      roles: Object.keys(rolesOf(obj.roles)).length ? rolesOf(obj.roles) : rolesOf(current.roles),
      slug,
      address: inboundAddressFor(slug),
      updatedAt: new Date().toISOString(),
    };
    const claimed = owner === id || await ledgerInsertIfNew(`inbound_aliases/${slug}`, {
      bookId: id,
      slug,
      name,
      updatedAt: record.updatedAt,
    });
    if (!claimed) continue;
    await ledgerSet(`inbound_mailboxes/${id}`, record);
    await stampBookMailbox(id, record).catch(() => undefined);
    return record;
  }
  return null;
}

async function stampBookMailbox(bookId: string, record: { slug: string; address: string }) {
  const sql = await getLedgerSql();
  const current = asObject(await ledgerGet(`books/${bookId}`));
  if (!current) return;
  if (text(current.inboundAddress) === record.address && text(current.inboundSlug) === record.slug) return;
  const next = { ...current, inboundAddress: record.address, inboundSlug: record.slug };
  const payload = JSON.stringify(next);
  await sql`UPDATE books SET data = ${payload}::jsonb, updated_at = NOW() WHERE id = ${bookId}`;
}

export async function ledgerResolveInboundSlug(local: string) {
  const slug = inboundMailboxSlug(local);
  if (!slug || RESERVED_INBOUND_LOCALS.has(slug)) return '';

  const alias = asObject(await ledgerGet(`inbound_aliases/${slug}`));
  const fromAlias = text(alias?.bookId);
  if (fromAlias) return fromAlias;

  const sql = await getLedgerSql();
  const mailboxes = asRows<{ book_id: string }>(
    await sql`
      SELECT book_id FROM inbound_mailboxes
      WHERE data->>'slug' = ${slug}
         OR lower(data->>'address') = ${`${slug}@${INBOUND_DOMAIN}`}
      LIMIT 1
    `,
  );
  const fromMailbox = text(mailboxes[0]?.book_id);
  if (fromMailbox) return fromMailbox;

  const claimed = asRows<{ id: string }>(
    await sql`
      SELECT id FROM books
      WHERE data->>'inboundSlug' = ${slug}
         OR lower(data->>'inboundAddress') = ${`${slug}@${INBOUND_DOMAIN}`}
      LIMIT 1
    `,
  );
  return text(claimed[0]?.id);
}

async function ensureLedgerSchema(sql: Sql) {
  await sql`CREATE TABLE IF NOT EXISTS documents (
    path TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT,
    display_name TEXT,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    owner_id TEXT,
    currency TEXT DEFAULT 'INR',
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS book_members (
    book_id TEXT NOT NULL,
    uid TEXT NOT NULL,
    role TEXT NOT NULL,
    email TEXT,
    PRIMARY KEY (book_id, uid)
  )`;
  await sql`CREATE INDEX IF NOT EXISTS book_members_uid_idx ON book_members (uid)`;
  await sql`CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    book_id TEXT,
    actor_uid TEXT,
    actor_email TEXT,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    detail JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS audit_events_book_idx ON audit_events (book_id, created_at DESC)`;
  await sql`CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    entry_type TEXT NOT NULL DEFAULT 'out',
    entry_date TEXT,
    paid_by_name TEXT,
    status TEXT,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    receipt_hash TEXT,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_hash TEXT`;
  await sql`UPDATE expenses SET receipt_hash = NULLIF(BTRIM(COALESCE(data->>'receiptHash', '')), '') WHERE receipt_hash IS NULL`;
  await sql`CREATE INDEX IF NOT EXISTS expenses_book_idx ON expenses (book_id, updated_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS expenses_book_amount_idx ON expenses (book_id, amount)`;
  await sql`CREATE INDEX IF NOT EXISTS expenses_book_live_idx ON expenses (book_id, deleted, updated_at DESC)`;
  try {
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS expenses_live_receipt_hash_idx ON expenses (book_id, receipt_hash) WHERE deleted = false AND receipt_hash IS NOT NULL AND receipt_hash <> ''`;
  } catch {
    // live duplicates must be cleaned before the unique index can apply
  }
  await sql`CREATE TABLE IF NOT EXISTS inbound_events (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    status TEXT,
    from_email TEXT,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS inbound_events_book_idx ON inbound_events (book_id, created_at DESC)`;
  await sql`CREATE TABLE IF NOT EXISTS email_events (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS email_events_book_idx ON email_events (book_id, created_at DESC)`;
  await sql`CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id)`;
  await sql`CREATE TABLE IF NOT EXISTS invites (
    id TEXT PRIMARY KEY,
    email TEXT,
    book_id TEXT,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS invites_email_idx ON invites (email)`;
  try {
    await sql`CREATE INDEX IF NOT EXISTS invites_email_pending_idx ON invites (email) WHERE COALESCE(data->>'deleted', '') NOT IN ('true', '1') AND COALESCE(NULLIF(data->>'status', ''), 'pending') = 'pending'`;
  } catch {
    // partial index is best-effort
  }
  await sql`CREATE TABLE IF NOT EXISTS inbound_hashes (
    book_id TEXT NOT NULL,
    hash TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (book_id, hash)
  )`;
  await sql`CREATE TABLE IF NOT EXISTS inbound_bills (
    book_id TEXT NOT NULL,
    fingerprint TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (book_id, fingerprint)
  )`;
  await sql`CREATE TABLE IF NOT EXISTS inbound_mailboxes (
    book_id TEXT PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS inbound_aliases (
    slug TEXT PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS inbound_pending (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS inbound_seen (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS erp_workspaces (
    id TEXT PRIMARY KEY,
    owner_uid TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL DEFAULT '',
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS erp_workspaces_owner_idx ON erp_workspaces (owner_uid)`;
  await sql`CREATE TABLE IF NOT EXISTS erp_records (
    workspace_id TEXT NOT NULL,
    collection TEXT NOT NULL,
    id TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (workspace_id, collection, id)
  )`;
  await sql`CREATE INDEX IF NOT EXISTS erp_records_ws_col_idx ON erp_records (workspace_id, collection, deleted, updated_at DESC)`;
  await copyLegacyDocuments(sql);
  await copyLegacyErp(sql);
}

async function copyLegacyDocuments(sql: Sql) {
  try {
    const marker = asRows(await sql`SELECT 1 FROM documents WHERE path = ${'meta/ledger_tables'} LIMIT 1`);
    if (marker.length) return;
    await sql`
      INSERT INTO users (id, email, display_name, data, updated_at)
      SELECT split_part(path, '/', 2), data->>'email', COALESCE(data->>'displayName', ''), data, updated_at
      FROM documents
      WHERE path LIKE ${'users/%'} AND path NOT LIKE ${'users/%/%'}
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO books (id, name, owner_id, currency, data, updated_at)
      SELECT split_part(path, '/', 2), COALESCE(data->>'name', ''), data->>'ownerId', COALESCE(data->>'currency', 'INR'), data, updated_at
      FROM documents
      WHERE path LIKE ${'books/%'} AND path NOT LIKE ${'books/%/%'}
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO book_members (book_id, uid, role, email)
      SELECT b.id, e.key, COALESCE(e.value->>'role', ''), e.value->>'email'
      FROM books b, LATERAL jsonb_each(COALESCE(b.data->'roles', '{}'::jsonb)) e
      ON CONFLICT (book_id, uid) DO NOTHING
    `;
    await sql`
      INSERT INTO expenses (id, book_id, amount, description, category, entry_type, entry_date, paid_by_name, status, deleted, data, created_at, updated_at)
      SELECT split_part(path, '/', 4), split_part(path, '/', 2),
        COALESCE(NULLIF(data->>'amount','')::double precision, 0),
        COALESCE(data->>'description', ''),
        COALESCE(data->>'category', ''),
        COALESCE(NULLIF(data->>'entryType',''), NULLIF(data->>'type',''), 'out'),
        data->>'date',
        data->>'paidByName',
        data->>'status',
        COALESCE((data->>'deleted')::boolean, FALSE) OR (data->>'deletedAt') IS NOT NULL OR data->>'status' = 'deleted',
        data,
        NULLIF(data->>'createdAt', '')::timestamptz,
        updated_at
      FROM documents
      WHERE path LIKE ${'books/%/expenses/%'} AND path NOT LIKE ${'books/%/expenses/%/%'}
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO inbound_events (id, book_id, status, from_email, data, created_at, updated_at)
      SELECT split_part(path, '/', 4), split_part(path, '/', 2), data->>'status', COALESCE(data->>'fromEmail', data->>'from'), data, NULLIF(data->>'createdAt', '')::timestamptz, updated_at
      FROM documents
      WHERE path LIKE ${'books/%/inbound_events/%'} AND path NOT LIKE ${'books/%/inbound_events/%/%'}
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO email_events (id, book_id, data, created_at, updated_at)
      SELECT split_part(path, '/', 4), split_part(path, '/', 2), data, NULLIF(data->>'createdAt', '')::timestamptz, updated_at
      FROM documents
      WHERE path LIKE ${'books/%/email_events/%'} AND path NOT LIKE ${'books/%/email_events/%/%'}
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO notifications (id, user_id, data, updated_at)
      SELECT split_part(path, '/', 2), data->>'userId', data, updated_at
      FROM documents
      WHERE path LIKE ${'notifications/%'} AND path NOT LIKE ${'notifications/%/%'}
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO invites (id, email, book_id, data, updated_at)
      SELECT split_part(path, '/', 2), data->>'email', data->>'bookId', data, updated_at
      FROM documents
      WHERE path LIKE ${'invites/%'} AND path NOT LIKE ${'invites/%/%'}
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO inbound_hashes (book_id, hash, data, updated_at)
      SELECT split_part(path, '/', 2), split_part(path, '/', 3), data, updated_at
      FROM documents
      WHERE path LIKE ${'inbound_hashes/%/%'}
      ON CONFLICT (book_id, hash) DO NOTHING
    `;
    await sql`
      INSERT INTO inbound_bills (book_id, fingerprint, data, updated_at)
      SELECT split_part(path, '/', 2), split_part(path, '/', 3), data, updated_at
      FROM documents
      WHERE path LIKE ${'inbound_bills/%/%'}
      ON CONFLICT (book_id, fingerprint) DO NOTHING
    `;
    await sql`
      INSERT INTO inbound_mailboxes (book_id, data, updated_at)
      SELECT split_part(path, '/', 2), data, updated_at
      FROM documents
      WHERE path LIKE ${'inbound_mailboxes/%'} AND path NOT LIKE ${'inbound_mailboxes/%/%'}
      ON CONFLICT (book_id) DO NOTHING
    `;
    await sql`
      INSERT INTO inbound_aliases (slug, data, updated_at)
      SELECT split_part(path, '/', 2), data, updated_at
      FROM documents
      WHERE path LIKE ${'inbound_aliases/%'} AND path NOT LIKE ${'inbound_aliases/%/%'}
      ON CONFLICT (slug) DO NOTHING
    `;
    await sql`
      INSERT INTO inbound_pending (id, data, updated_at)
      SELECT split_part(path, '/', 2), data, updated_at
      FROM documents
      WHERE path LIKE ${'inbound_pending/%'} AND path NOT LIKE ${'inbound_pending/%/%'}
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO inbound_seen (id, data, updated_at)
      SELECT split_part(path, '/', 2), data, updated_at
      FROM documents
      WHERE path LIKE ${'inbound_seen/%'} AND path NOT LIKE ${'inbound_seen/%/%'}
      ON CONFLICT (id) DO NOTHING
    `;
    const payload = JSON.stringify({ at: new Date().toISOString() });
    await sql`
      INSERT INTO documents (path, data, updated_at)
      VALUES (${'meta/ledger_tables'}, ${payload}::jsonb, NOW())
      ON CONFLICT (path) DO NOTHING
    `;
  } catch {
    // tables still work if the one-time copy finds nothing
  }
}

type ErpRef =
  | { kind: 'none' }
  | { kind: 'skip' }
  | { kind: 'workspace'; ws: string }
  | { kind: 'tenant'; ws: string }
  | { kind: 'record'; ws: string; collection: string; id: string };

function parseErpPath(path: string): ErpRef {
  let parts: string[] = [];
  try {
    parts = cleanPath(path).split('/').filter(Boolean);
  } catch {
    return { kind: 'none' };
  }
  if (parts[0] !== 'erp_workspaces' || parts.length < 2) return { kind: 'none' };
  const ws = parts[1];
  const rel = parts.slice(2);
  if (!rel.length) return { kind: 'workspace', ws };
  const relPath = rel.join('/');
  if (relPath === 'meta/pack' || relPath === '_snapshot') return { kind: 'skip' };
  if (relPath === 'meta/tenant') return { kind: 'tenant', ws };
  if (rel.length < 2) return { kind: 'skip' };
  return { kind: 'record', ws, collection: rel.slice(0, -1).join('/'), id: rel[rel.length - 1] };
}

async function copyLegacyErp(sql: Sql) {
  try {
    const marker = asRows(await sql`SELECT 1 FROM documents WHERE path = ${'meta/erp_tables'} LIMIT 1`);
    if (marker.length) return;
    const rows = asRows<{ path: string; data: unknown }>(
      await sql`SELECT path, data FROM documents WHERE path LIKE ${'erp_workspaces/%'}`,
    );
    for (const row of rows) {
      const parsed = parseErpPath(String(row.path || ''));
      const data = asObject(row.data);
      if (!data) continue;
      const payload = JSON.stringify(data);
      if (parsed.kind === 'tenant') {
        await sql`
          INSERT INTO erp_workspaces (id, owner_uid, name, data, updated_at)
          VALUES (
            ${parsed.ws},
            ${text(data.ownerId || data.rootOwnerId || parsed.ws)},
            ${text(data.name) || 'Books workspace'},
            ${payload}::jsonb,
            NOW()
          )
          ON CONFLICT (id) DO NOTHING
        `;
      } else if (parsed.kind === 'record') {
        await sql`
          INSERT INTO erp_records (workspace_id, collection, id, data, deleted, updated_at)
          VALUES (
            ${parsed.ws},
            ${parsed.collection},
            ${parsed.id},
            ${payload}::jsonb,
            ${flag(data)},
            NOW()
          )
          ON CONFLICT (workspace_id, collection, id) DO NOTHING
        `;
      }
    }
    const payload = JSON.stringify({ at: new Date().toISOString() });
    await sql`
      INSERT INTO documents (path, data, updated_at)
      VALUES (${'meta/erp_tables'}, ${payload}::jsonb, NOW())
      ON CONFLICT (path) DO NOTHING
    `;
  } catch {
    // Books still loads from documents until the copy can run
  }
}

async function erpGet(path: string) {
  const parsed = parseErpPath(path);
  if (parsed.kind === 'none' || parsed.kind === 'skip') return null;
  const sql = await getLedgerSql();
  const pick = (result: unknown) => {
    const list = asRows<{ data: unknown }>(result);
    return list[0] ? asObject(list[0].data) : null;
  };
  if (parsed.kind === 'tenant' || parsed.kind === 'workspace') {
    const row = pick(await sql`SELECT data FROM erp_workspaces WHERE id = ${parsed.ws} LIMIT 1`);
    if (row) return row;
  } else {
    const row = pick(await sql`
      SELECT data FROM erp_records
      WHERE workspace_id = ${parsed.ws} AND collection = ${parsed.collection} AND id = ${parsed.id}
      LIMIT 1
    `);
    if (row) return row;
  }
  const legacy = pick(await sql`SELECT data FROM documents WHERE path = ${cleanPath(path)} LIMIT 1`);
  if (legacy) await erpSet(path, legacy).catch(() => undefined);
  return legacy;
}

async function erpSet(path: string, data: unknown, insertOnly = false) {
  const parsed = parseErpPath(path);
  if (parsed.kind === 'none' || parsed.kind === 'skip') return false;
  const sql = await getLedgerSql();
  const obj = asObject(data) || {};
  const payload = JSON.stringify(obj);
  if (parsed.kind === 'tenant' || parsed.kind === 'workspace') {
    if (insertOnly) {
      const rows = await sql`
        INSERT INTO erp_workspaces (id, owner_uid, name, data, updated_at)
        VALUES (
          ${parsed.ws},
          ${text(obj.ownerId || obj.rootOwnerId || parsed.ws)},
          ${text(obj.name) || 'Books workspace'},
          ${payload}::jsonb,
          NOW()
        )
        ON CONFLICT (id) DO NOTHING RETURNING id
      `;
      return asRows(rows).length > 0;
    }
    await sql`
      INSERT INTO erp_workspaces (id, owner_uid, name, data, updated_at)
      VALUES (
        ${parsed.ws},
        ${text(obj.ownerId || obj.rootOwnerId || parsed.ws)},
        ${text(obj.name) || 'Books workspace'},
        ${payload}::jsonb,
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        owner_uid = EXCLUDED.owner_uid,
        name = EXCLUDED.name,
        data = EXCLUDED.data,
        updated_at = NOW()
    `;
    return true;
  }
  if (insertOnly) {
    const rows = await sql`
      INSERT INTO erp_records (workspace_id, collection, id, data, deleted, updated_at)
      VALUES (${parsed.ws}, ${parsed.collection}, ${parsed.id}, ${payload}::jsonb, ${flag(obj)}, NOW())
      ON CONFLICT (workspace_id, collection, id) DO NOTHING RETURNING id
    `;
    return asRows(rows).length > 0;
  }
  await sql`
    INSERT INTO erp_records (workspace_id, collection, id, data, deleted, updated_at)
    VALUES (${parsed.ws}, ${parsed.collection}, ${parsed.id}, ${payload}::jsonb, ${flag(obj)}, NOW())
    ON CONFLICT (workspace_id, collection, id) DO UPDATE SET
      data = EXCLUDED.data,
      deleted = EXCLUDED.deleted,
      updated_at = NOW()
  `;
  return true;
}

async function erpDel(path: string) {
  const parsed = parseErpPath(path);
  if (parsed.kind !== 'record') return false;
  const sql = await getLedgerSql();
  const stamp = JSON.stringify({ deleted: true, deletedAt: new Date().toISOString() });
  await sql`
    UPDATE erp_records
    SET deleted = TRUE,
        data = COALESCE(data, '{}'::jsonb) || ${stamp}::jsonb,
        updated_at = NOW()
    WHERE workspace_id = ${parsed.ws} AND collection = ${parsed.collection} AND id = ${parsed.id}
  `;
  return true;
}

async function erpList(prefix: string) {
  const parts = cleanPath(prefix).split('/').filter(Boolean);
  if (parts[0] !== 'erp_workspaces' || parts.length < 3) return null;
  const ws = parts[1];
  const collection = parts.slice(2).join('/');
  const sql = await getLedgerSql();
  const rows = rowsOf(
    await sql`
      SELECT id, data FROM erp_records
      WHERE workspace_id = ${ws} AND collection = ${collection} AND deleted = FALSE
      ORDER BY updated_at DESC
    `,
  );
  if (rows.length) return rows;
  const base = `${cleanPath(prefix)}/`;
  const legacy = asRows<{ path: string; data: unknown }>(
    await sql`SELECT path, data FROM documents WHERE path LIKE ${base + '%'}`,
  );
  const out: { id: string; data: Record<string, unknown> }[] = [];
  for (const row of legacy) {
    const rest = String(row.path).slice(base.length);
    const data = asObject(row.data);
    if (!rest || rest.includes('/') || !data || flag(data)) continue;
    out.push({ id: rest, data });
    await erpSet(`${base}${rest}`, data).catch(() => undefined);
  }
  return out;
}

export async function erpLoadWorkspace(ws: string) {
  const id = text(ws);
  const sql = await getLedgerSql();
  const tenantRows = asRows<{ data: unknown }>(await sql`SELECT data FROM erp_workspaces WHERE id = ${id} LIMIT 1`);
  const recs = asRows<{ collection: string; id: string; data: unknown }>(
    await sql`
      SELECT collection, id, data FROM erp_records
      WHERE workspace_id = ${id} AND deleted = FALSE
    `,
  );
  const docs: Record<string, Record<string, unknown>> = {};
  let tenant = tenantRows[0] ? asObject(tenantRows[0].data) : null;
  if (tenant) docs['meta/tenant'] = tenant;
  for (const rec of recs) {
    const data = asObject(rec.data);
    if (!data) continue;
    docs[`${rec.collection}/${rec.id}`] = data;
  }
  if (tenant || recs.length) return { tenant, docs };

  const prefix = `erp_workspaces/${id}/`;
  const legacy = asRows<{ path: string; data: unknown }>(
    await sql`SELECT path, data FROM documents WHERE path LIKE ${prefix + '%'}`,
  );
  for (const row of legacy) {
    const rel = String(row.path).slice(prefix.length);
    const data = asObject(row.data);
    if (!rel || !data || rel === 'meta/pack' || rel === '_snapshot') continue;
    if (rel === 'meta/tenant') tenant = data;
    docs[rel] = data;
    await erpSet(`${prefix}${rel}`, data).catch(() => undefined);
  }
  return { tenant, docs };
}

async function syncBookMembers(sql: Sql, bookId: string, data: Record<string, unknown>) {
  const roles = data.roles && typeof data.roles === 'object' && !Array.isArray(data.roles)
    ? data.roles as Record<string, { role?: string; email?: string }>
    : {};
  await sql`DELETE FROM book_members WHERE book_id = ${bookId}`;
  for (const [uid, rec] of Object.entries(roles)) {
    const role = text(rec?.role);
    if (!uid || !role) continue;
    await sql`
      INSERT INTO book_members (book_id, uid, role, email)
      VALUES (${bookId}, ${uid}, ${role}, ${text(rec?.email)})
      ON CONFLICT (book_id, uid) DO UPDATE SET role = EXCLUDED.role, email = EXCLUDED.email
    `;
  }
}

async function putDocument(sql: Sql, path: string, data: unknown, insertOnly = false) {
  const p = cleanPath(path);
  const payload = JSON.stringify(data ?? {});
  if (insertOnly) {
    const rows = await sql`
      INSERT INTO documents (path, data, updated_at)
      VALUES (${p}, ${payload}::jsonb, NOW())
      ON CONFLICT (path) DO NOTHING
      RETURNING path
    `;
    return asRows(rows).length > 0;
  }
  await sql`
    INSERT INTO documents (path, data, updated_at)
    VALUES (${p}, ${payload}::jsonb, NOW())
    ON CONFLICT (path) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
  `;
  return true;
}

export async function ledgerGet(path: string): Promise<Record<string, unknown> | null> {
  const sql = await getLedgerSql();
  const p = cleanPath(path);
  const parts = p.split('/').filter(Boolean);
  const pick = (result: unknown) => {
    const list = asRows<{ data: unknown }>(result);
    return list[0] ? asObject(list[0].data) : null;
  };

  if (parts[0] === 'erp_workspaces') return erpGet(p);
  if (parts[0] === 'users' && parts.length === 2) return pick(await sql`SELECT data FROM users WHERE id = ${parts[1]} LIMIT 1`);
  if (parts[0] === 'books' && parts.length === 2) return pick(await sql`SELECT data FROM books WHERE id = ${parts[1]} LIMIT 1`);
  if (parts[0] === 'books' && parts[2] === 'expenses' && parts.length === 4) {
    return pick(await sql`SELECT data FROM expenses WHERE book_id = ${parts[1]} AND id = ${parts[3]} LIMIT 1`);
  }
  if (parts[0] === 'books' && parts[2] === 'inbound_events' && parts.length === 4) {
    return pick(await sql`SELECT data FROM inbound_events WHERE book_id = ${parts[1]} AND id = ${parts[3]} LIMIT 1`);
  }
  if (parts[0] === 'books' && parts[2] === 'email_events' && parts.length === 4) {
    return pick(await sql`SELECT data FROM email_events WHERE book_id = ${parts[1]} AND id = ${parts[3]} LIMIT 1`);
  }
  if (parts[0] === 'notifications' && parts.length === 2) return pick(await sql`SELECT data FROM notifications WHERE id = ${parts[1]} LIMIT 1`);
  if (parts[0] === 'invites' && parts.length === 2) return pick(await sql`SELECT data FROM invites WHERE id = ${parts[1]} LIMIT 1`);
  if (parts[0] === 'inbound_hashes' && parts.length === 3) {
    return pick(await sql`SELECT data FROM inbound_hashes WHERE book_id = ${parts[1]} AND hash = ${parts[2]} LIMIT 1`);
  }
  if (parts[0] === 'inbound_bills' && parts.length === 3) {
    return pick(await sql`SELECT data FROM inbound_bills WHERE book_id = ${parts[1]} AND fingerprint = ${parts[2]} LIMIT 1`);
  }
  if (parts[0] === 'inbound_mailboxes' && parts.length === 2) {
    return pick(await sql`SELECT data FROM inbound_mailboxes WHERE book_id = ${parts[1]} LIMIT 1`);
  }
  if (parts[0] === 'inbound_aliases' && parts.length === 2) {
    return pick(await sql`SELECT data FROM inbound_aliases WHERE slug = ${parts[1]} LIMIT 1`);
  }
  if (parts[0] === 'inbound_pending' && parts.length === 2) {
    return pick(await sql`SELECT data FROM inbound_pending WHERE id = ${parts[1]} LIMIT 1`);
  }
  if (parts[0] === 'inbound_seen' && parts.length === 2) {
    return pick(await sql`SELECT data FROM inbound_seen WHERE id = ${parts[1]} LIMIT 1`);
  }
  return pick(await sql`SELECT data FROM documents WHERE path = ${p} LIMIT 1`);
}

export async function ledgerSet(path: string, data: unknown, insertOnly = false): Promise<boolean> {
  const sql = await getLedgerSql();
  const p = cleanPath(path);
  const parts = p.split('/').filter(Boolean);
  const obj = asObject(data) || {};
  const payload = JSON.stringify(obj);
  const id = parts[parts.length - 1];

  if (parts[0] === 'erp_workspaces') return erpSet(p, obj, insertOnly);
  if (parts[0] === 'users' && parts.length === 2) {
    if (insertOnly) {
      const rows = await sql`
        INSERT INTO users (id, email, display_name, data, updated_at)
        VALUES (${id}, ${text(obj.email)}, ${text(obj.displayName)}, ${payload}::jsonb, NOW())
        ON CONFLICT (id) DO NOTHING RETURNING id
      `;
      return asRows(rows).length > 0;
    }
    await sql`
      INSERT INTO users (id, email, display_name, data, updated_at)
      VALUES (${id}, ${text(obj.email)}, ${text(obj.displayName)}, ${payload}::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, display_name = EXCLUDED.display_name, data = EXCLUDED.data, updated_at = NOW()
    `;
    return true;
  }

  if (parts[0] === 'books' && parts.length === 2) {
    if (insertOnly) {
      const rows = await sql`
        INSERT INTO books (id, name, owner_id, currency, data, updated_at)
        VALUES (${id}, ${text(obj.name)}, ${text(obj.ownerId)}, ${text(obj.currency) || 'INR'}, ${payload}::jsonb, NOW())
        ON CONFLICT (id) DO NOTHING RETURNING id
      `;
      if (asRows(rows).length) {
        await syncBookMembers(sql, id, obj);
        await ledgerEnsureMailbox(id, obj).catch(() => undefined);
      }
      return asRows(rows).length > 0;
    }
    await sql`
      INSERT INTO books (id, name, owner_id, currency, data, updated_at)
      VALUES (${id}, ${text(obj.name)}, ${text(obj.ownerId)}, ${text(obj.currency) || 'INR'}, ${payload}::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, owner_id = EXCLUDED.owner_id, currency = EXCLUDED.currency, data = EXCLUDED.data, updated_at = NOW()
    `;
    await syncBookMembers(sql, id, obj);
    if (!text(obj.inboundSlug) && !text(obj.inboundAddress)) {
      await ledgerEnsureMailbox(id, obj).catch(() => undefined);
    }
    return true;
  }

  if (parts[0] === 'books' && parts[2] === 'expenses' && parts.length === 4) {
    const bookId = parts[1];
    const created = ts(obj.createdAt);
    const hash = text(obj.receiptHash) || null;
    if (insertOnly) {
      const rows = await sql`
        INSERT INTO expenses (id, book_id, amount, description, category, entry_type, entry_date, paid_by_name, status, deleted, receipt_hash, data, created_at, updated_at)
        VALUES (
          ${id}, ${bookId}, ${num(obj.amount)}, ${text(obj.description)}, ${text(obj.category)},
          ${text(obj.entryType || obj.type) || 'out'}, ${text(obj.date)}, ${text(obj.paidByName)},
          ${text(obj.status)}, ${flag(obj)}, ${hash}, ${payload}::jsonb, ${created}::timestamptz, NOW()
        )
        ON CONFLICT (id) DO NOTHING RETURNING id
      `;
      return asRows(rows).length > 0;
    }
    await sql`
      INSERT INTO expenses (id, book_id, amount, description, category, entry_type, entry_date, paid_by_name, status, deleted, receipt_hash, data, created_at, updated_at)
      VALUES (
        ${id}, ${bookId}, ${num(obj.amount)}, ${text(obj.description)}, ${text(obj.category)},
        ${text(obj.entryType || obj.type) || 'out'}, ${text(obj.date)}, ${text(obj.paidByName)},
        ${text(obj.status)}, ${flag(obj)}, ${hash}, ${payload}::jsonb, ${created}::timestamptz, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        book_id = EXCLUDED.book_id, amount = EXCLUDED.amount, description = EXCLUDED.description,
        category = EXCLUDED.category, entry_type = EXCLUDED.entry_type, entry_date = EXCLUDED.entry_date,
        paid_by_name = EXCLUDED.paid_by_name, status = EXCLUDED.status, deleted = EXCLUDED.deleted,
        receipt_hash = COALESCE(EXCLUDED.receipt_hash, expenses.receipt_hash),
        data = EXCLUDED.data, updated_at = NOW()
    `;
    return true;
  }

  if (parts[0] === 'books' && parts[2] === 'inbound_events' && parts.length === 4) {
    const bookId = parts[1];
    const created = ts(obj.createdAt);
    if (insertOnly) {
      const rows = await sql`
        INSERT INTO inbound_events (id, book_id, status, from_email, data, created_at, updated_at)
        VALUES (${id}, ${bookId}, ${text(obj.status)}, ${text(obj.fromEmail || obj.from)}, ${payload}::jsonb, ${created}::timestamptz, NOW())
        ON CONFLICT (id) DO NOTHING RETURNING id
      `;
      return asRows(rows).length > 0;
    }
    await sql`
      INSERT INTO inbound_events (id, book_id, status, from_email, data, created_at, updated_at)
      VALUES (${id}, ${bookId}, ${text(obj.status)}, ${text(obj.fromEmail || obj.from)}, ${payload}::jsonb, ${created}::timestamptz, NOW())
      ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, from_email = EXCLUDED.from_email, data = EXCLUDED.data, updated_at = NOW()
    `;
    return true;
  }

  if (parts[0] === 'books' && parts[2] === 'email_events' && parts.length === 4) {
    const bookId = parts[1];
    const created = ts(obj.createdAt);
    if (insertOnly) {
      const rows = await sql`
        INSERT INTO email_events (id, book_id, data, created_at, updated_at)
        VALUES (${id}, ${bookId}, ${payload}::jsonb, ${created}::timestamptz, NOW())
        ON CONFLICT (id) DO NOTHING RETURNING id
      `;
      return asRows(rows).length > 0;
    }
    await sql`
      INSERT INTO email_events (id, book_id, data, created_at, updated_at)
      VALUES (${id}, ${bookId}, ${payload}::jsonb, ${created}::timestamptz, NOW())
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
    `;
    return true;
  }

  if (parts[0] === 'notifications' && parts.length === 2) {
    if (insertOnly) {
      const rows = await sql`
        INSERT INTO notifications (id, user_id, data, updated_at)
        VALUES (${id}, ${text(obj.userId)}, ${payload}::jsonb, NOW())
        ON CONFLICT (id) DO NOTHING RETURNING id
      `;
      return asRows(rows).length > 0;
    }
    await sql`
      INSERT INTO notifications (id, user_id, data, updated_at)
      VALUES (${id}, ${text(obj.userId)}, ${payload}::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id, data = EXCLUDED.data, updated_at = NOW()
    `;
    return true;
  }

  if (parts[0] === 'invites' && parts.length === 2) {
    if (insertOnly) {
      const rows = await sql`
        INSERT INTO invites (id, email, book_id, data, updated_at)
        VALUES (${id}, ${text(obj.email)}, ${text(obj.bookId)}, ${payload}::jsonb, NOW())
        ON CONFLICT (id) DO NOTHING RETURNING id
      `;
      return asRows(rows).length > 0;
    }
    await sql`
      INSERT INTO invites (id, email, book_id, data, updated_at)
      VALUES (${id}, ${text(obj.email)}, ${text(obj.bookId)}, ${payload}::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, book_id = EXCLUDED.book_id, data = EXCLUDED.data, updated_at = NOW()
    `;
    return true;
  }

  if (parts[0] === 'inbound_hashes' && parts.length === 3) {
    if (insertOnly) {
      const rows = await sql`
        INSERT INTO inbound_hashes (book_id, hash, data, updated_at)
        VALUES (${parts[1]}, ${parts[2]}, ${payload}::jsonb, NOW())
        ON CONFLICT (book_id, hash) DO NOTHING RETURNING hash
      `;
      return asRows(rows).length > 0;
    }
    await sql`
      INSERT INTO inbound_hashes (book_id, hash, data, updated_at)
      VALUES (${parts[1]}, ${parts[2]}, ${payload}::jsonb, NOW())
      ON CONFLICT (book_id, hash) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
    `;
    return true;
  }

  if (parts[0] === 'inbound_bills' && parts.length === 3) {
    if (insertOnly) {
      const rows = await sql`
        INSERT INTO inbound_bills (book_id, fingerprint, data, updated_at)
        VALUES (${parts[1]}, ${parts[2]}, ${payload}::jsonb, NOW())
        ON CONFLICT (book_id, fingerprint) DO NOTHING RETURNING fingerprint
      `;
      return asRows(rows).length > 0;
    }
    await sql`
      INSERT INTO inbound_bills (book_id, fingerprint, data, updated_at)
      VALUES (${parts[1]}, ${parts[2]}, ${payload}::jsonb, NOW())
      ON CONFLICT (book_id, fingerprint) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
    `;
    return true;
  }

  if (parts[0] === 'inbound_mailboxes' && parts.length === 2) {
    await sql`
      INSERT INTO inbound_mailboxes (book_id, data, updated_at)
      VALUES (${parts[1]}, ${payload}::jsonb, NOW())
      ON CONFLICT (book_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
    `;
    return true;
  }
  if (parts[0] === 'inbound_aliases' && parts.length === 2) {
    if (insertOnly) {
      const rows = await sql`
        INSERT INTO inbound_aliases (slug, data, updated_at)
        VALUES (${parts[1]}, ${payload}::jsonb, NOW())
        ON CONFLICT (slug) DO NOTHING RETURNING slug
      `;
      return asRows(rows).length > 0;
    }
    const existing = asObject(await ledgerGet(`inbound_aliases/${parts[1]}`));
    const owner = text(existing?.bookId);
    const incoming = text(obj.bookId);
    if (owner && incoming && owner !== incoming) return false;
    await sql`
      INSERT INTO inbound_aliases (slug, data, updated_at)
      VALUES (${parts[1]}, ${payload}::jsonb, NOW())
      ON CONFLICT (slug) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
    `;
    return true;
  }
  if (parts[0] === 'inbound_pending' && parts.length === 2) {
    await sql`
      INSERT INTO inbound_pending (id, data, updated_at)
      VALUES (${parts[1]}, ${payload}::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
    `;
    return true;
  }
  if (parts[0] === 'inbound_seen' && parts.length === 2) {
    if (insertOnly) {
      const rows = await sql`
        INSERT INTO inbound_seen (id, data, updated_at)
        VALUES (${parts[1]}, ${payload}::jsonb, NOW())
        ON CONFLICT (id) DO NOTHING RETURNING id
      `;
      return asRows(rows).length > 0;
    }
    await sql`
      INSERT INTO inbound_seen (id, data, updated_at)
      VALUES (${parts[1]}, ${payload}::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
    `;
    return true;
  }

  return putDocument(sql, p, obj, insertOnly);
}

export async function ledgerInsertIfNew(path: string, data: unknown) {
  return ledgerSet(path, data, true);
}

export async function ledgerAudit(event: {
  bookId?: string;
  actorUid?: string;
  actorEmail?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  detail?: Record<string, unknown>;
}) {
  const sql = await getLedgerSql();
  const id = randomBytes(12).toString('hex');
  const detail = JSON.stringify(event.detail || {});
  await sql`
    INSERT INTO audit_events (id, book_id, actor_uid, actor_email, action, entity_type, entity_id, detail, created_at)
    VALUES (
      ${id},
      ${text(event.bookId) || null},
      ${text(event.actorUid) || null},
      ${text(event.actorEmail) || null},
      ${text(event.action)},
      ${text(event.entityType) || null},
      ${text(event.entityId) || null},
      ${detail}::jsonb,
      NOW()
    )
  `;
}

export async function ledgerDel(path: string) {
  const sql = await getLedgerSql();
  const p = cleanPath(path);
  const parts = p.split('/').filter(Boolean);
  if (parts[0] === 'erp_workspaces') {
    await erpDel(p);
    return;
  }
  if (parts[0] === 'users' && parts.length === 2) await sql`DELETE FROM users WHERE id = ${parts[1]}`;
  else if (parts[0] === 'books' && parts.length === 2) {
    await sql`DELETE FROM book_members WHERE book_id = ${parts[1]}`;
    await sql`DELETE FROM books WHERE id = ${parts[1]}`;
  } else if (parts[0] === 'books' && parts[2] === 'expenses' && parts.length === 4) {
    await sql`DELETE FROM expenses WHERE book_id = ${parts[1]} AND id = ${parts[3]}`;
  } else if (parts[0] === 'books' && parts[2] === 'inbound_events' && parts.length === 4) {
    await sql`DELETE FROM inbound_events WHERE book_id = ${parts[1]} AND id = ${parts[3]}`;
  } else if (parts[0] === 'books' && parts[2] === 'email_events' && parts.length === 4) {
    await sql`DELETE FROM email_events WHERE book_id = ${parts[1]} AND id = ${parts[3]}`;
  } else if (parts[0] === 'notifications' && parts.length === 2) await sql`DELETE FROM notifications WHERE id = ${parts[1]}`;
  else if (parts[0] === 'invites' && parts.length === 2) await sql`DELETE FROM invites WHERE id = ${parts[1]}`;
  else await sql`DELETE FROM documents WHERE path = ${p}`;
}

function rowsOf(result: unknown) {
  return asRows<{ id: string; data: unknown }>(result)
    .map((row) => {
      const data = asObject(row.data);
      return data ? { id: String(row.id), data } : null;
    })
    .filter(Boolean) as { id: string; data: Record<string, unknown> }[];
}

export async function ledgerList(prefix: string, constraints: any[] = []) {
  const sql = await getLedgerSql();
  const parts = cleanPath(prefix).split('/').filter(Boolean);

  if (parts[0] === 'erp_workspaces') {
    const rows = await erpList(prefix);
    return rows || [];
  }

  if (parts[0] === 'books' && parts.length === 1) {
    const roleFilter = constraints.find((c) => c?.type === 'where' && String(c.field || '').startsWith('roles.') && String(c.field).endsWith('.role'));
    if (roleFilter) {
      const uid = String(roleFilter.field).split('.')[1] || '';
      const rows = await sql`
        SELECT b.id, b.data
        FROM books b
        INNER JOIN book_members m ON m.book_id = b.id
        WHERE m.uid = ${uid}
      `;
      return rowsOf(rows);
    }
    const rows = await sql`SELECT id, data FROM books`;
    return rowsOf(rows);
  }

  if (parts[0] === 'books' && parts[2] === 'expenses' && parts.length === 3) {
    const rows = await sql`SELECT id, data, deleted FROM expenses WHERE book_id = ${parts[1]} ORDER BY updated_at DESC`;
    return asRows<{ id: string; data: unknown; deleted?: boolean }>(rows)
      .map((row) => {
        const data = asObject(row.data);
        if (!data || row.deleted === true || flag(data)) return null;
        return { id: String(row.id), data };
      })
      .filter(Boolean) as { id: string; data: Record<string, unknown> }[];
  }
  if (parts[0] === 'books' && parts[2] === 'inbound_events' && parts.length === 3) {
    const rows = await sql`SELECT id, data FROM inbound_events WHERE book_id = ${parts[1]} ORDER BY created_at DESC NULLS LAST, updated_at DESC`;
    return rowsOf(rows);
  }
  if (parts[0] === 'books' && parts[2] === 'email_events' && parts.length === 3) {
    const rows = await sql`SELECT id, data FROM email_events WHERE book_id = ${parts[1]} ORDER BY created_at DESC NULLS LAST, updated_at DESC`;
    return rowsOf(rows);
  }
  if (parts[0] === 'notifications' && parts.length === 1) {
    const userFilter = constraints.find((c) => c?.type === 'where' && c.field === 'userId' && c.op === '==');
    if (userFilter) {
      const rows = await sql`SELECT id, data FROM notifications WHERE user_id = ${String(userFilter.value)}`;
      return rowsOf(rows);
    }
    const rows = await sql`SELECT id, data FROM notifications`;
    return rowsOf(rows);
  }
  if (parts[0] === 'invites' && parts.length === 1) {
    const emailFilter = constraints.find((c) => c?.type === 'where' && c.field === 'email' && c.op === '==');
    const rows = emailFilter
      ? await sql`SELECT id, data FROM invites WHERE email = ${String(emailFilter.value)}`
      : await sql`SELECT id, data FROM invites`;
    return rowsOf(rows).filter((row) => !flag(row.data) && String(row.data.status || 'pending') === 'pending');
  }
  if (parts[0] === 'inbound_hashes' && parts.length === 2) {
    const rows = await sql`SELECT hash AS id, data FROM inbound_hashes WHERE book_id = ${parts[1]}`;
    return rowsOf(rows);
  }
  if (parts[0] === 'inbound_bills' && parts.length === 2) {
    const rows = await sql`SELECT fingerprint AS id, data FROM inbound_bills WHERE book_id = ${parts[1]}`;
    return rowsOf(rows);
  }

  const base = `${cleanPath(prefix)}/`;
  const docs = asRows<{ path: string; data: unknown }>(
    await sql`SELECT path, data FROM documents WHERE path LIKE ${base + '%'}`,
  );
  return docs
    .map((row) => {
      const rest = String(row.path).slice(base.length);
      const data = asObject(row.data);
      if (!rest || rest.includes('/') || !data) return null;
      return { id: rest, data };
    })
    .filter(Boolean) as { id: string; data: Record<string, unknown> }[];
}

export async function ledgerListExpensesByBooks(bookIds: string[]) {
  if (!bookIds.length) return new Map<string, { id: string; data: Record<string, unknown> }[]>();
  const sql = await getLedgerSql();
  const rows = await sql`SELECT id, book_id, data, deleted FROM expenses WHERE book_id = ANY(${bookIds}) AND deleted = false`;
  const grouped = new Map<string, { id: string; data: Record<string, unknown> }[]>();
  for (const row of asRows<{ id: string; book_id: string; data: unknown; deleted?: boolean }>(rows)) {
    const data = asObject(row.data);
    if (!data || row.deleted === true || flag(data)) continue;
    const col = `books/${row.book_id}/expenses`;
    const list = grouped.get(col) || [];
    list.push({ id: String(row.id), data });
    grouped.set(col, list);
  }
  return grouped;
}

export function newLedgerId() {
  return randomBytes(12).toString('hex');
}

export function ledgerUniqueViolation(err: unknown) {
  const e = err as { code?: string; message?: string };
  return e?.code === '23505' || /duplicate key|unique constraint/i.test(String(e?.message || ''));
}

export type LedgerMember = { role: string; email: string };

export async function ledgerMember(bookId: string, uid: string): Promise<LedgerMember | null> {
  const id = text(bookId);
  const userId = text(uid);
  if (!id || !userId) return null;
  const sql = await getLedgerSql();
  const rows = asRows<{ role: string; email: string; data: unknown }>(
    await sql`
      SELECT m.role, m.email, b.data
      FROM book_members m
      INNER JOIN books b ON b.id = m.book_id
      WHERE m.book_id = ${id} AND m.uid = ${userId}
      LIMIT 1
    `,
  );
  const row = rows[0];
  if (row) {
    const data = asObject(row.data) || {};
    if (flag(data)) return null;
    return { role: text(row.role), email: text(row.email) };
  }
  const book = asObject(await ledgerGet(`books/${id}`));
  if (!book || flag(book)) return null;
  const roles = rolesOf(book.roles);
  const rec = roles[userId] as { role?: string; email?: string } | undefined;
  if (rec?.role) return { role: text(rec.role), email: text(rec.email) };
  if (text(book.ownerId) === userId) return { role: 'owner', email: '' };
  return null;
}

export async function ledgerHasPendingInvite(bookId: string, email: string) {
  const id = text(bookId);
  const mail = text(email).trim().toLowerCase();
  if (!id || !mail) return false;
  const sql = await getLedgerSql();
  const rows = asRows(
    await sql`
      SELECT id FROM invites
      WHERE book_id = ${id}
        AND lower(email) = ${mail}
        AND COALESCE(data->>'deleted', '') NOT IN ('true', '1')
        AND COALESCE(NULLIF(data->>'status', ''), 'pending') = 'pending'
      LIMIT 1
    `,
  );
  return rows.length > 0;
}

export async function ledgerRequireMember(bookId: string, uid: string) {
  const member = await ledgerMember(bookId, uid);
  if (!member) {
    const err: Error & { status?: number } = new Error('You do not have access to this ledger');
    err.status = 403;
    throw err;
  }
  return member;
}

export async function ledgerRequireManager(bookId: string, uid: string) {
  const member = await ledgerRequireMember(bookId, uid);
  if (member.role !== 'owner' && member.role !== 'admin') {
    const err: Error & { status?: number } = new Error('Not allowed to manage this ledger');
    err.status = 403;
    throw err;
  }
  return member;
}

export async function ledgerRequireWriter(bookId: string, uid: string) {
  const member = await ledgerRequireMember(bookId, uid);
  if (!['owner', 'admin', 'contributor'].includes(member.role)) {
    const err: Error & { status?: number } = new Error('Not allowed to change this ledger');
    err.status = 403;
    throw err;
  }
  return member;
}

function bookRow(id: string, data: Record<string, unknown>): Record<string, unknown> {
  return { ...data, id };
}

export async function ledgerListBooksForUser(uid: string) {
  const rows = await ledgerList('books', [{ type: 'where', field: `roles.${uid}.role`, op: 'in', value: ['owner'] }]);
  return rows
    .filter((row) => !flag(row.data))
    .map((row) => bookRow(row.id, row.data));
}

export async function ledgerGetBookForUser(bookId: string, uid: string) {
  await ledgerRequireMember(bookId, uid);
  const data = asObject(await ledgerGet(`books/${bookId}`));
  if (!data || flag(data)) {
    const err: Error & { status?: number } = new Error('Ledger not found');
    err.status = 404;
    throw err;
  }
  return bookRow(bookId, data);
}

export async function ledgerCreateBook(input: {
  uid: string;
  email: string;
  name: string;
  currency?: string;
}) {
  const name = text(input.name).trim();
  if (!name) {
    const err: Error & { status?: number } = new Error('Ledger name is required');
    err.status = 400;
    throw err;
  }
  const id = newLedgerId();
  const now = new Date().toISOString();
  const data = {
    id,
    name,
    ownerId: input.uid,
    currency: text(input.currency) || 'INR',
    createdAt: now,
    roles: { [input.uid]: { role: 'owner', email: text(input.email).toLowerCase() } },
  };
  await ledgerSet(`books/${id}`, data);
  await ledgerAudit({
    bookId: id,
    actorUid: input.uid,
    actorEmail: input.email,
    action: 'ledger.create',
    entityType: 'book',
    entityId: id,
    detail: { name },
  });
  const mailbox = await ledgerEnsureMailbox(id, data).catch(() => null);
  return {
    ...data,
    inboundAddress: mailbox && typeof mailbox === 'object' ? text((mailbox as { address?: string }).address) : '',
    inboundSlug: mailbox && typeof mailbox === 'object' ? text((mailbox as { slug?: string }).slug) : '',
  };
}

export async function ledgerUpdateBook(bookId: string, uid: string, patch: Record<string, unknown>) {
  const current = await ledgerGetBookForUser(bookId, uid);
  const next: Record<string, unknown> = { ...current, ...patch, id: bookId };
  if (patch.roles && typeof patch.roles === 'object') next.roles = patch.roles;
  await ledgerSet(`books/${bookId}`, next);
  await ledgerAudit({
    bookId,
    actorUid: uid,
    action: 'ledger.update',
    entityType: 'book',
    entityId: bookId,
  });
  return next;
}

export async function ledgerRemoveMember(bookId: string, actorUid: string, uidToRemove: string) {
  const book = await ledgerGetBookForUser(bookId, actorUid);
  const roles = rolesOf(book.roles) as Record<string, { role?: string; email?: string }>;
  if (!roles[uidToRemove]) {
    const err: Error & { status?: number } = new Error('Member not found');
    err.status = 404;
    throw err;
  }
  if (roles[uidToRemove]?.role === 'owner') {
    const owners = Object.values(roles).filter((row) => row?.role === 'owner').length;
    if (owners <= 1) {
      const err: Error & { status?: number } = new Error('You cannot remove the last owner of the ledger.');
      err.status = 400;
      throw err;
    }
  }
  if (uidToRemove !== actorUid) await ledgerRequireManager(bookId, actorUid);
  const nextRoles = { ...roles };
  delete nextRoles[uidToRemove];
  const next = { ...book, roles: nextRoles };
  await ledgerSet(`books/${bookId}`, next);
  await ledgerAudit({
    bookId,
    actorUid,
    action: 'ledger.remove_member',
    entityType: 'book',
    entityId: bookId,
    detail: { uidToRemove },
  });
  return next;
}

export async function ledgerSoftDeleteBook(bookId: string, uid: string) {
  await ledgerRequireManager(bookId, uid);
  const current = asObject(await ledgerGet(`books/${bookId}`)) || {};
  const next = {
    ...current,
    deleted: true,
    deletedAt: new Date().toISOString(),
    deletedBy: uid,
    status: 'deleted',
  };
  await ledgerSet(`books/${bookId}`, next);
  await ledgerAudit({
    bookId,
    actorUid: uid,
    action: 'ledger.soft_delete',
    entityType: 'book',
    entityId: bookId,
  });
  return next;
}

export async function ledgerLiveExpenseByHash(bookId: string, hash: string) {
  const value = text(hash);
  if (!value) return null;
  const sql = await getLedgerSql();
  const rows = asRows<{ id: string; data: unknown }>(
    await sql`
      SELECT id, data FROM expenses
      WHERE book_id = ${bookId} AND deleted = false AND receipt_hash = ${value}
      LIMIT 1
    `,
  );
  const row = rows[0];
  const data = row ? asObject(row.data) : null;
  if (!row || !data || flag(data)) return null;
  return { id: String(row.id), ...data };
}

export async function ledgerListLiveExpenses(bookId: string) {
  const rows = await ledgerList(`books/${bookId}/expenses`);
  return rows.map((row) => ({ id: row.id, ...row.data }));
}

export async function ledgerGetExpense(bookId: string, expenseId: string) {
  const data = asObject(await ledgerGet(`books/${bookId}/expenses/${expenseId}`));
  if (!data || flag(data)) return null;
  return { id: expenseId, ...data };
}

export async function ledgerSaveExpense(
  bookId: string,
  expense: Record<string, unknown>,
  opts?: { insertOnly?: boolean },
) {
  const id = text(expense.id) || newLedgerId();
  const row: Record<string, unknown> = { ...expense, id };
  try {
    const wrote = await ledgerSet(`books/${bookId}/expenses/${id}`, row, Boolean(opts?.insertOnly));
    if (opts?.insertOnly && !wrote) {
      const existing = asObject(await ledgerGet(`books/${bookId}/expenses/${id}`));
      return { expense: { id, ...(existing || row) }, created: false };
    }
  } catch (err) {
    if (ledgerUniqueViolation(err)) {
      const existing = await ledgerLiveExpenseByHash(bookId, text(row.receiptHash));
      const dup: Error & { status?: number; existing?: Record<string, unknown> | null } = new Error('This receipt is already recorded');
      dup.status = 409;
      dup.existing = existing;
      throw dup;
    }
    throw err;
  }
  return { expense: row, created: true };
}

export async function ledgerSoftDeleteExpense(bookId: string, expenseId: string, uid: string) {
  const current = asObject(await ledgerGet(`books/${bookId}/expenses/${expenseId}`));
  if (!current || flag(current)) return false;
  const next = {
    ...current,
    id: expenseId,
    deleted: true,
    deletedAt: new Date().toISOString(),
    deletedBy: uid,
    status: 'deleted',
  };
  await ledgerSet(`books/${bookId}/expenses/${expenseId}`, next);
  return true;
}

export async function ledgerListNotifications(userId: string) {
  const rows = await ledgerList('notifications', [{ type: 'where', field: 'userId', op: '==', value: userId }]);
  return rows
    .filter((row) => text(row.data.userId) === userId && !flag(row.data))
    .map((row) => ({ id: row.id, ...row.data }));
}

export async function ledgerAddNotification(data: Record<string, unknown>) {
  const id = text(data.id) || newLedgerId();
  const row = {
    ...data,
    id,
    userId: text(data.userId),
    createdAt: text(data.createdAt) || new Date().toISOString(),
    read: Boolean(data.read),
  };
  await ledgerSet(`notifications/${id}`, row);
  return row;
}

export async function ledgerMarkNotificationRead(id: string, userId: string) {
  const current = asObject(await ledgerGet(`notifications/${id}`));
  if (!current) return null;
  if (text(current.userId) !== userId) {
    const err: Error & { status?: number } = new Error('Notification not found');
    err.status = 404;
    throw err;
  }
  const next = { ...current, read: true };
  await ledgerSet(`notifications/${id}`, next);
  return { id, ...next };
}

export async function ledgerGetUser(uid: string) {
  return asObject(await ledgerGet(`users/${uid}`));
}

export async function ledgerUpsertUser(uid: string, patch: Record<string, unknown>, merge = true) {
  const current = (await ledgerGetUser(uid)) || {};
  const next = merge ? { ...current, ...patch, uid } : { ...patch, uid };
  await ledgerSet(`users/${uid}`, next);
  return next;
}

export async function ledgerListMailEvents(bookId: string) {
  const [inbound, outbound] = await Promise.all([
    ledgerList(`books/${bookId}/inbound_events`),
    ledgerList(`books/${bookId}/email_events`),
  ]);
  return {
    inbound: inbound.map((row) => ({ id: row.id, direction: 'inbound', ...row.data })),
    outbound: outbound.map((row) => ({ id: row.id, direction: 'outbound', ...row.data })),
  };
}

export async function ledgerAddEmailEvent(bookId: string, data: Record<string, unknown>) {
  const id = text(data.id) || newLedgerId();
  const row = { ...data, id, createdAt: text(data.createdAt) || new Date().toISOString() };
  await ledgerSet(`books/${bookId}/email_events/${id}`, row);
  return row;
}

type ApiReq = { method?: string; headers: Record<string, unknown>; body?: unknown };
type ApiRes = { statusCode: number; setHeader: (name: string, value: string) => void; end: (body?: string) => void };

const FIREBASE_PROJECT = 'gen-lang-client-0616065043';
const jwtMem = new Map<string, { uid: string; email: string; exp: number }>();
let jwks: any = null;

export type ApiUser = { uid: string; email: string };

export class ApiError extends Error {
  status: number;
  extra?: Record<string, unknown>;
  constructor(status: number, message: string, extra?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export function applyApiCors(req: ApiReq, res: ApiRes) {
  const origin = String(req.headers.origin || '');
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  if (origin) res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');
}

export function apiJson(res: ApiRes, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
}

function readApiBody(req: ApiReq): Record<string, unknown> {
  const raw = req.body;
  if (typeof raw === 'string') return JSON.parse(raw || '{}');
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
  return {};
}

export async function verifyFirebaseUser(token: string): Promise<ApiUser | null> {
  const hit = jwtMem.get(token);
  if (hit && hit.exp > Date.now() + 5000) return { uid: hit.uid, email: hit.email };
  const { createRemoteJWKSet, jwtVerify } = await import('jose');
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
  }
  const { payload } = await jwtVerify(token, jwks, {
    issuer: `https://securetoken.google.com/${FIREBASE_PROJECT}`,
    audience: FIREBASE_PROJECT,
  });
  const uid = String(payload.user_id || payload.sub || '');
  const email = String(payload.email || '').trim().toLowerCase();
  const exp = Number(payload.exp || 0) * 1000 || Date.now() + 50_000;
  if (!uid) return null;
  jwtMem.set(token, { uid, email, exp });
  if (jwtMem.size > 300) jwtMem.clear();
  return { uid, email };
}

export async function requireApiUser(req: ApiReq, res: ApiRes): Promise<ApiUser | null> {
  const header = String(req.headers.authorization || '');
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  let user: ApiUser | null = null;
  try {
    user = token ? await verifyFirebaseUser(token) : null;
  } catch {
    user = null;
  }
  if (!user) {
    apiJson(res, 401, { error: 'Sign in required' });
    return null;
  }
  return user;
}

export function handleApiError(res: ApiRes, err: unknown) {
  const e = err as { status?: number; message?: string; extra?: Record<string, unknown> };
  const status = Number(e?.status || 500) || 500;
  apiJson(res, status, { error: e?.message || 'Request failed', ...(e?.extra || {}) });
}

export async function withDomainApi(
  req: ApiReq,
  res: ApiRes,
  fn: (user: ApiUser, body: Record<string, unknown>) => Promise<void>,
) {
  try {
    applyApiCors(req, res);
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    if (req.method !== 'POST') {
      apiJson(res, 405, { error: 'POST required' });
      return;
    }
    const user = await requireApiUser(req, res);
    if (!user) return;
    await fn(user, readApiBody(req));
  } catch (err) {
    handleApiError(res, err);
  }
}

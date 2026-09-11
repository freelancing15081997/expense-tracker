import { neon } from "@neondatabase/serverless";
import { randomBytes } from "node:crypto";
function asRows(result) {
  return Array.isArray(result) ? result : [];
}
function postgresUrl() {
  const raw = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_PRISMA_URL || process.env.BYJAN_NEON_DATABASE_URL || process.env.BYJAN_NEON_POSTGRES_URL || process.env.BYJAN_NEON_DATABASE_URL_UNPOOLED || process.env.BYJAN_NEON_POSTGRES_URL_NON_POOLING || "";
  if (!raw) return "";
  try {
    const url = new URL(raw);
    url.searchParams.delete("channel_binding");
    return url.toString();
  } catch {
    return raw;
  }
}
function cleanPath(path) {
  const clean = path.replace(/^\/+|\/+$/g, "").replace(/\.\./g, "");
  if (!clean || !/^[a-zA-Z0-9_./@+-]+$/.test(clean)) throw new Error("Invalid path");
  return clean;
}
function asObject(value) {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value;
}
let sqlMem = null;
let schemaReady = false;
async function getLedgerSql() {
  const url = postgresUrl();
  if (!url) throw new Error("Postgres is not configured");
  if (!sqlMem) sqlMem = neon(url);
  if (!schemaReady) {
    await ensureLedgerSchema(sqlMem);
    schemaReady = true;
  }
  return sqlMem;
}
function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
function text(value) {
  return value == null ? "" : String(value);
}
function ts(value) {
  if (typeof value === "string" && value && !Number.isNaN(Date.parse(value))) return value;
  return null;
}
function flag(data) {
  const deleted = data.deleted;
  return deleted === true || deleted === "true" || deleted === 1 || deleted === "1" || Boolean(data.deletedAt) || data.status === "deleted";
}
const INBOUND_DOMAIN = "easypado.com";
const RESERVED_INBOUND_LOCALS = /* @__PURE__ */ new Set([
  "support",
  "info",
  "noreply",
  "no-reply",
  "admin",
  "welcome",
  "byjanbooks",
  "hello",
  "contact",
  "mail",
  "email"
]);
function inboundMailboxSlug(name) {
  const slug = String(name || "").toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").replace(/[_\s]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return slug || "ledger";
}
function inboundAddressFor(slug) {
  return `${inboundMailboxSlug(slug)}@${INBOUND_DOMAIN}`;
}
function shortBookId(bookId) {
  return String(bookId || "").replace(/[^a-zA-Z0-9]/g, "").slice(-6).toLowerCase() || "book";
}
function rolesOf(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}
async function ledgerEnsureMailbox(bookId, data = {}) {
  const id = String(bookId || "").trim();
  if (!id) return null;
  const obj = asObject(data) || {};
  const current = asObject(await ledgerGet(`inbound_mailboxes/${id}`)) || {};
  const existingSlug = inboundMailboxSlug(text(current.slug));
  if (existingSlug && text(current.address)) {
    const record = {
      bookId: id,
      name: text(obj.name || current.name) || "Ledger",
      currency: text(obj.currency || current.currency) || "INR",
      ownerId: text(obj.ownerId || current.ownerId),
      roles: Object.keys(rolesOf(obj.roles)).length ? rolesOf(obj.roles) : rolesOf(current.roles),
      slug: existingSlug,
      address: text(current.address) || inboundAddressFor(existingSlug),
      updatedAt: text(current.updatedAt) || (/* @__PURE__ */ new Date()).toISOString()
    };
    if (text(obj.inboundAddress) !== record.address || text(obj.inboundSlug) !== record.slug) {
      await stampBookMailbox(id, record).catch(() => void 0);
    }
    return record;
  }
  const name = text(obj.name || current.name) || "Ledger";
  const preferred = inboundMailboxSlug(name);
  const start = RESERVED_INBOUND_LOCALS.has(preferred) ? `${preferred}-ledger` : preferred;
  const candidates = [];
  const seen = /* @__PURE__ */ new Set();
  for (const candidate of [start, ...Array.from({ length: 19 }, (_, i) => `${start}-${i + 2}`), `${start}-${shortBookId(id)}`]) {
    const slug = inboundMailboxSlug(candidate);
    if (!slug || seen.has(slug) || RESERVED_INBOUND_LOCALS.has(slug)) continue;
    seen.add(slug);
    candidates.push(slug);
  }
  if (!candidates.length) return null;
  const sql = await getLedgerSql();
  const takenRows = asRows(
    await sql`SELECT slug, data->>'bookId' AS book_id FROM inbound_aliases WHERE slug = ANY(${candidates})`
  );
  const taken = new Map(takenRows.map((row) => [text(row.slug), text(row.book_id)]));
  for (const slug of candidates) {
    const owner = taken.get(slug) || "";
    if (owner && owner !== id) continue;
    const record = {
      bookId: id,
      name,
      currency: text(obj.currency || current.currency) || "INR",
      ownerId: text(obj.ownerId || current.ownerId),
      roles: Object.keys(rolesOf(obj.roles)).length ? rolesOf(obj.roles) : rolesOf(current.roles),
      slug,
      address: inboundAddressFor(slug),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const claimed = owner === id || await ledgerInsertIfNew(`inbound_aliases/${slug}`, {
      bookId: id,
      slug,
      name,
      updatedAt: record.updatedAt
    });
    if (!claimed) continue;
    await ledgerSet(`inbound_mailboxes/${id}`, record);
    await stampBookMailbox(id, record).catch(() => void 0);
    return record;
  }
  return null;
}
async function stampBookMailbox(bookId, record) {
  const sql = await getLedgerSql();
  const current = asObject(await ledgerGet(`books/${bookId}`));
  if (!current) return;
  if (text(current.inboundAddress) === record.address && text(current.inboundSlug) === record.slug) return;
  const next = { ...current, inboundAddress: record.address, inboundSlug: record.slug };
  const payload = JSON.stringify(next);
  await sql`UPDATE books SET data = ${payload}::jsonb, updated_at = NOW() WHERE id = ${bookId}`;
}
async function ledgerResolveInboundSlug(local) {
  const slug = inboundMailboxSlug(local);
  if (!slug || RESERVED_INBOUND_LOCALS.has(slug)) return "";
  const alias = asObject(await ledgerGet(`inbound_aliases/${slug}`));
  const fromAlias = text(alias?.bookId);
  if (fromAlias) return fromAlias;
  const sql = await getLedgerSql();
  const mailboxes = asRows(
    await sql`
      SELECT book_id FROM inbound_mailboxes
      WHERE data->>'slug' = ${slug}
         OR lower(data->>'address') = ${`${slug}@${INBOUND_DOMAIN}`}
      LIMIT 1
    `
  );
  const fromMailbox = text(mailboxes[0]?.book_id);
  if (fromMailbox) return fromMailbox;
  const claimed = asRows(
    await sql`
      SELECT id FROM books
      WHERE data->>'inboundSlug' = ${slug}
         OR lower(data->>'inboundAddress') = ${`${slug}@${INBOUND_DOMAIN}`}
      LIMIT 1
    `
  );
  return text(claimed[0]?.id);
}
async function ensureLedgerSchema(sql) {
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
  await copyLegacyDocuments(sql);
}
async function copyLegacyDocuments(sql) {
  try {
    const marker = asRows(await sql`SELECT 1 FROM documents WHERE path = ${"meta/ledger_tables"} LIMIT 1`);
    if (marker.length) return;
    await sql`
      INSERT INTO users (id, email, display_name, data, updated_at)
      SELECT split_part(path, '/', 2), data->>'email', COALESCE(data->>'displayName', ''), data, updated_at
      FROM documents
      WHERE path LIKE ${"users/%"} AND path NOT LIKE ${"users/%/%"}
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO books (id, name, owner_id, currency, data, updated_at)
      SELECT split_part(path, '/', 2), COALESCE(data->>'name', ''), data->>'ownerId', COALESCE(data->>'currency', 'INR'), data, updated_at
      FROM documents
      WHERE path LIKE ${"books/%"} AND path NOT LIKE ${"books/%/%"}
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
      WHERE path LIKE ${"books/%/expenses/%"} AND path NOT LIKE ${"books/%/expenses/%/%"}
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO inbound_events (id, book_id, status, from_email, data, created_at, updated_at)
      SELECT split_part(path, '/', 4), split_part(path, '/', 2), data->>'status', COALESCE(data->>'fromEmail', data->>'from'), data, NULLIF(data->>'createdAt', '')::timestamptz, updated_at
      FROM documents
      WHERE path LIKE ${"books/%/inbound_events/%"} AND path NOT LIKE ${"books/%/inbound_events/%/%"}
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO email_events (id, book_id, data, created_at, updated_at)
      SELECT split_part(path, '/', 4), split_part(path, '/', 2), data, NULLIF(data->>'createdAt', '')::timestamptz, updated_at
      FROM documents
      WHERE path LIKE ${"books/%/email_events/%"} AND path NOT LIKE ${"books/%/email_events/%/%"}
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO notifications (id, user_id, data, updated_at)
      SELECT split_part(path, '/', 2), data->>'userId', data, updated_at
      FROM documents
      WHERE path LIKE ${"notifications/%"} AND path NOT LIKE ${"notifications/%/%"}
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO invites (id, email, book_id, data, updated_at)
      SELECT split_part(path, '/', 2), data->>'email', data->>'bookId', data, updated_at
      FROM documents
      WHERE path LIKE ${"invites/%"} AND path NOT LIKE ${"invites/%/%"}
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO inbound_hashes (book_id, hash, data, updated_at)
      SELECT split_part(path, '/', 2), split_part(path, '/', 3), data, updated_at
      FROM documents
      WHERE path LIKE ${"inbound_hashes/%/%"}
      ON CONFLICT (book_id, hash) DO NOTHING
    `;
    await sql`
      INSERT INTO inbound_bills (book_id, fingerprint, data, updated_at)
      SELECT split_part(path, '/', 2), split_part(path, '/', 3), data, updated_at
      FROM documents
      WHERE path LIKE ${"inbound_bills/%/%"}
      ON CONFLICT (book_id, fingerprint) DO NOTHING
    `;
    await sql`
      INSERT INTO inbound_mailboxes (book_id, data, updated_at)
      SELECT split_part(path, '/', 2), data, updated_at
      FROM documents
      WHERE path LIKE ${"inbound_mailboxes/%"} AND path NOT LIKE ${"inbound_mailboxes/%/%"}
      ON CONFLICT (book_id) DO NOTHING
    `;
    await sql`
      INSERT INTO inbound_aliases (slug, data, updated_at)
      SELECT split_part(path, '/', 2), data, updated_at
      FROM documents
      WHERE path LIKE ${"inbound_aliases/%"} AND path NOT LIKE ${"inbound_aliases/%/%"}
      ON CONFLICT (slug) DO NOTHING
    `;
    await sql`
      INSERT INTO inbound_pending (id, data, updated_at)
      SELECT split_part(path, '/', 2), data, updated_at
      FROM documents
      WHERE path LIKE ${"inbound_pending/%"} AND path NOT LIKE ${"inbound_pending/%/%"}
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO inbound_seen (id, data, updated_at)
      SELECT split_part(path, '/', 2), data, updated_at
      FROM documents
      WHERE path LIKE ${"inbound_seen/%"} AND path NOT LIKE ${"inbound_seen/%/%"}
      ON CONFLICT (id) DO NOTHING
    `;
    const payload = JSON.stringify({ at: (/* @__PURE__ */ new Date()).toISOString() });
    await sql`
      INSERT INTO documents (path, data, updated_at)
      VALUES (${"meta/ledger_tables"}, ${payload}::jsonb, NOW())
      ON CONFLICT (path) DO NOTHING
    `;
  } catch {
  }
}
async function syncBookMembers(sql, bookId, data) {
  const roles = data.roles && typeof data.roles === "object" && !Array.isArray(data.roles) ? data.roles : {};
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
async function putDocument(sql, path, data, insertOnly = false) {
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
async function ledgerGet(path) {
  const sql = await getLedgerSql();
  const p = cleanPath(path);
  const parts = p.split("/").filter(Boolean);
  const pick = (result) => {
    const list = asRows(result);
    return list[0] ? asObject(list[0].data) : null;
  };
  if (parts[0] === "users" && parts.length === 2) return pick(await sql`SELECT data FROM users WHERE id = ${parts[1]} LIMIT 1`);
  if (parts[0] === "books" && parts.length === 2) return pick(await sql`SELECT data FROM books WHERE id = ${parts[1]} LIMIT 1`);
  if (parts[0] === "books" && parts[2] === "expenses" && parts.length === 4) {
    return pick(await sql`SELECT data FROM expenses WHERE book_id = ${parts[1]} AND id = ${parts[3]} LIMIT 1`);
  }
  if (parts[0] === "books" && parts[2] === "inbound_events" && parts.length === 4) {
    return pick(await sql`SELECT data FROM inbound_events WHERE book_id = ${parts[1]} AND id = ${parts[3]} LIMIT 1`);
  }
  if (parts[0] === "books" && parts[2] === "email_events" && parts.length === 4) {
    return pick(await sql`SELECT data FROM email_events WHERE book_id = ${parts[1]} AND id = ${parts[3]} LIMIT 1`);
  }
  if (parts[0] === "notifications" && parts.length === 2) return pick(await sql`SELECT data FROM notifications WHERE id = ${parts[1]} LIMIT 1`);
  if (parts[0] === "invites" && parts.length === 2) return pick(await sql`SELECT data FROM invites WHERE id = ${parts[1]} LIMIT 1`);
  if (parts[0] === "inbound_hashes" && parts.length === 3) {
    return pick(await sql`SELECT data FROM inbound_hashes WHERE book_id = ${parts[1]} AND hash = ${parts[2]} LIMIT 1`);
  }
  if (parts[0] === "inbound_bills" && parts.length === 3) {
    return pick(await sql`SELECT data FROM inbound_bills WHERE book_id = ${parts[1]} AND fingerprint = ${parts[2]} LIMIT 1`);
  }
  if (parts[0] === "inbound_mailboxes" && parts.length === 2) {
    return pick(await sql`SELECT data FROM inbound_mailboxes WHERE book_id = ${parts[1]} LIMIT 1`);
  }
  if (parts[0] === "inbound_aliases" && parts.length === 2) {
    return pick(await sql`SELECT data FROM inbound_aliases WHERE slug = ${parts[1]} LIMIT 1`);
  }
  if (parts[0] === "inbound_pending" && parts.length === 2) {
    return pick(await sql`SELECT data FROM inbound_pending WHERE id = ${parts[1]} LIMIT 1`);
  }
  if (parts[0] === "inbound_seen" && parts.length === 2) {
    return pick(await sql`SELECT data FROM inbound_seen WHERE id = ${parts[1]} LIMIT 1`);
  }
  return pick(await sql`SELECT data FROM documents WHERE path = ${p} LIMIT 1`);
}
async function ledgerSet(path, data, insertOnly = false) {
  const sql = await getLedgerSql();
  const p = cleanPath(path);
  const parts = p.split("/").filter(Boolean);
  const obj = asObject(data) || {};
  const payload = JSON.stringify(obj);
  const id = parts[parts.length - 1];
  if (parts[0] === "users" && parts.length === 2) {
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
  if (parts[0] === "books" && parts.length === 2) {
    if (insertOnly) {
      const rows = await sql`
        INSERT INTO books (id, name, owner_id, currency, data, updated_at)
        VALUES (${id}, ${text(obj.name)}, ${text(obj.ownerId)}, ${text(obj.currency) || "INR"}, ${payload}::jsonb, NOW())
        ON CONFLICT (id) DO NOTHING RETURNING id
      `;
      if (asRows(rows).length) {
        await syncBookMembers(sql, id, obj);
        await ledgerEnsureMailbox(id, obj).catch(() => void 0);
      }
      return asRows(rows).length > 0;
    }
    await sql`
      INSERT INTO books (id, name, owner_id, currency, data, updated_at)
      VALUES (${id}, ${text(obj.name)}, ${text(obj.ownerId)}, ${text(obj.currency) || "INR"}, ${payload}::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, owner_id = EXCLUDED.owner_id, currency = EXCLUDED.currency, data = EXCLUDED.data, updated_at = NOW()
    `;
    await syncBookMembers(sql, id, obj);
    if (!text(obj.inboundSlug) && !text(obj.inboundAddress)) {
      await ledgerEnsureMailbox(id, obj).catch(() => void 0);
    }
    return true;
  }
  if (parts[0] === "books" && parts[2] === "expenses" && parts.length === 4) {
    const bookId = parts[1];
    const created = ts(obj.createdAt);
    const hash = text(obj.receiptHash) || null;
    if (insertOnly) {
      const rows = await sql`
        INSERT INTO expenses (id, book_id, amount, description, category, entry_type, entry_date, paid_by_name, status, deleted, receipt_hash, data, created_at, updated_at)
        VALUES (
          ${id}, ${bookId}, ${num(obj.amount)}, ${text(obj.description)}, ${text(obj.category)},
          ${text(obj.entryType || obj.type) || "out"}, ${text(obj.date)}, ${text(obj.paidByName)},
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
        ${text(obj.entryType || obj.type) || "out"}, ${text(obj.date)}, ${text(obj.paidByName)},
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
  if (parts[0] === "books" && parts[2] === "inbound_events" && parts.length === 4) {
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
  if (parts[0] === "books" && parts[2] === "email_events" && parts.length === 4) {
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
  if (parts[0] === "notifications" && parts.length === 2) {
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
  if (parts[0] === "invites" && parts.length === 2) {
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
  if (parts[0] === "inbound_hashes" && parts.length === 3) {
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
  if (parts[0] === "inbound_bills" && parts.length === 3) {
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
  if (parts[0] === "inbound_mailboxes" && parts.length === 2) {
    await sql`
      INSERT INTO inbound_mailboxes (book_id, data, updated_at)
      VALUES (${parts[1]}, ${payload}::jsonb, NOW())
      ON CONFLICT (book_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
    `;
    return true;
  }
  if (parts[0] === "inbound_aliases" && parts.length === 2) {
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
  if (parts[0] === "inbound_pending" && parts.length === 2) {
    await sql`
      INSERT INTO inbound_pending (id, data, updated_at)
      VALUES (${parts[1]}, ${payload}::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
    `;
    return true;
  }
  if (parts[0] === "inbound_seen" && parts.length === 2) {
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
async function ledgerInsertIfNew(path, data) {
  return ledgerSet(path, data, true);
}
async function ledgerAudit(event) {
  const sql = await getLedgerSql();
  const id = randomBytes(12).toString("hex");
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
async function ledgerDel(path) {
  const sql = await getLedgerSql();
  const p = cleanPath(path);
  const parts = p.split("/").filter(Boolean);
  if (parts[0] === "users" && parts.length === 2) await sql`DELETE FROM users WHERE id = ${parts[1]}`;
  else if (parts[0] === "books" && parts.length === 2) {
    await sql`DELETE FROM book_members WHERE book_id = ${parts[1]}`;
    await sql`DELETE FROM books WHERE id = ${parts[1]}`;
  } else if (parts[0] === "books" && parts[2] === "expenses" && parts.length === 4) {
    await sql`DELETE FROM expenses WHERE book_id = ${parts[1]} AND id = ${parts[3]}`;
  } else if (parts[0] === "books" && parts[2] === "inbound_events" && parts.length === 4) {
    await sql`DELETE FROM inbound_events WHERE book_id = ${parts[1]} AND id = ${parts[3]}`;
  } else if (parts[0] === "books" && parts[2] === "email_events" && parts.length === 4) {
    await sql`DELETE FROM email_events WHERE book_id = ${parts[1]} AND id = ${parts[3]}`;
  } else if (parts[0] === "notifications" && parts.length === 2) await sql`DELETE FROM notifications WHERE id = ${parts[1]}`;
  else if (parts[0] === "invites" && parts.length === 2) await sql`DELETE FROM invites WHERE id = ${parts[1]}`;
  else await sql`DELETE FROM documents WHERE path = ${p}`;
}
function rowsOf(result) {
  return asRows(result).map((row) => {
    const data = asObject(row.data);
    return data ? { id: String(row.id), data } : null;
  }).filter(Boolean);
}
async function ledgerList(prefix, constraints = []) {
  const sql = await getLedgerSql();
  const parts = cleanPath(prefix).split("/").filter(Boolean);
  if (parts[0] === "books" && parts.length === 1) {
    const roleFilter = constraints.find((c) => c?.type === "where" && String(c.field || "").startsWith("roles.") && String(c.field).endsWith(".role"));
    if (roleFilter) {
      const uid = String(roleFilter.field).split(".")[1] || "";
      const rows2 = await sql`
        SELECT b.id, b.data
        FROM books b
        INNER JOIN book_members m ON m.book_id = b.id
        WHERE m.uid = ${uid}
      `;
      return rowsOf(rows2);
    }
    const rows = await sql`SELECT id, data FROM books`;
    return rowsOf(rows);
  }
  if (parts[0] === "books" && parts[2] === "expenses" && parts.length === 3) {
    const rows = await sql`SELECT id, data, deleted FROM expenses WHERE book_id = ${parts[1]} ORDER BY updated_at DESC`;
    return asRows(rows).map((row) => {
      const data = asObject(row.data);
      if (!data || row.deleted === true || flag(data)) return null;
      return { id: String(row.id), data };
    }).filter(Boolean);
  }
  if (parts[0] === "books" && parts[2] === "inbound_events" && parts.length === 3) {
    const rows = await sql`SELECT id, data FROM inbound_events WHERE book_id = ${parts[1]} ORDER BY created_at DESC NULLS LAST, updated_at DESC`;
    return rowsOf(rows);
  }
  if (parts[0] === "books" && parts[2] === "email_events" && parts.length === 3) {
    const rows = await sql`SELECT id, data FROM email_events WHERE book_id = ${parts[1]} ORDER BY created_at DESC NULLS LAST, updated_at DESC`;
    return rowsOf(rows);
  }
  if (parts[0] === "notifications" && parts.length === 1) {
    const userFilter = constraints.find((c) => c?.type === "where" && c.field === "userId" && c.op === "==");
    if (userFilter) {
      const rows2 = await sql`SELECT id, data FROM notifications WHERE user_id = ${String(userFilter.value)}`;
      return rowsOf(rows2);
    }
    const rows = await sql`SELECT id, data FROM notifications`;
    return rowsOf(rows);
  }
  if (parts[0] === "invites" && parts.length === 1) {
    const emailFilter = constraints.find((c) => c?.type === "where" && c.field === "email" && c.op === "==");
    const rows = emailFilter ? await sql`SELECT id, data FROM invites WHERE email = ${String(emailFilter.value)}` : await sql`SELECT id, data FROM invites`;
    return rowsOf(rows).filter((row) => !flag(row.data) && String(row.data.status || "pending") === "pending");
  }
  if (parts[0] === "inbound_hashes" && parts.length === 2) {
    const rows = await sql`SELECT hash AS id, data FROM inbound_hashes WHERE book_id = ${parts[1]}`;
    return rowsOf(rows);
  }
  if (parts[0] === "inbound_bills" && parts.length === 2) {
    const rows = await sql`SELECT fingerprint AS id, data FROM inbound_bills WHERE book_id = ${parts[1]}`;
    return rowsOf(rows);
  }
  const base = `${cleanPath(prefix)}/`;
  const docs = asRows(
    await sql`SELECT path, data FROM documents WHERE path LIKE ${base + "%"}`
  );
  return docs.map((row) => {
    const rest = String(row.path).slice(base.length);
    const data = asObject(row.data);
    if (!rest || rest.includes("/") || !data) return null;
    return { id: rest, data };
  }).filter(Boolean);
}
async function ledgerListExpensesByBooks(bookIds) {
  if (!bookIds.length) return /* @__PURE__ */ new Map();
  const sql = await getLedgerSql();
  const rows = await sql`SELECT id, book_id, data, deleted FROM expenses WHERE book_id = ANY(${bookIds}) AND deleted = false`;
  const grouped = /* @__PURE__ */ new Map();
  for (const row of asRows(rows)) {
    const data = asObject(row.data);
    if (!data || row.deleted === true || flag(data)) continue;
    const col = `books/${row.book_id}/expenses`;
    const list = grouped.get(col) || [];
    list.push({ id: String(row.id), data });
    grouped.set(col, list);
  }
  return grouped;
}
function newLedgerId() {
  return randomBytes(12).toString("hex");
}
function ledgerUniqueViolation(err) {
  const e = err;
  return e?.code === "23505" || /duplicate key|unique constraint/i.test(String(e?.message || ""));
}
async function ledgerMember(bookId, uid) {
  const id = text(bookId);
  const userId = text(uid);
  if (!id || !userId) return null;
  const sql = await getLedgerSql();
  const rows = asRows(
    await sql`
      SELECT m.role, m.email, b.data
      FROM book_members m
      INNER JOIN books b ON b.id = m.book_id
      WHERE m.book_id = ${id} AND m.uid = ${userId}
      LIMIT 1
    `
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
  const rec = roles[userId];
  if (rec?.role) return { role: text(rec.role), email: text(rec.email) };
  if (text(book.ownerId) === userId) return { role: "owner", email: "" };
  return null;
}
async function ledgerRequireMember(bookId, uid) {
  const member = await ledgerMember(bookId, uid);
  if (!member) {
    const err = new Error("You do not have access to this ledger");
    err.status = 403;
    throw err;
  }
  return member;
}
async function ledgerRequireManager(bookId, uid) {
  const member = await ledgerRequireMember(bookId, uid);
  if (member.role !== "owner" && member.role !== "admin") {
    const err = new Error("Not allowed to manage this ledger");
    err.status = 403;
    throw err;
  }
  return member;
}
async function ledgerRequireWriter(bookId, uid) {
  const member = await ledgerRequireMember(bookId, uid);
  if (!["owner", "admin", "contributor"].includes(member.role)) {
    const err = new Error("Not allowed to change this ledger");
    err.status = 403;
    throw err;
  }
  return member;
}
function bookRow(id, data) {
  return { ...data, id };
}
async function ledgerListBooksForUser(uid) {
  const rows = await ledgerList("books", [{ type: "where", field: `roles.${uid}.role`, op: "in", value: ["owner"] }]);
  return rows.filter((row) => !flag(row.data)).map((row) => bookRow(row.id, row.data));
}
async function ledgerGetBookForUser(bookId, uid) {
  await ledgerRequireMember(bookId, uid);
  const data = asObject(await ledgerGet(`books/${bookId}`));
  if (!data || flag(data)) {
    const err = new Error("Ledger not found");
    err.status = 404;
    throw err;
  }
  return bookRow(bookId, data);
}
async function ledgerCreateBook(input) {
  const name = text(input.name).trim();
  if (!name) {
    const err = new Error("Ledger name is required");
    err.status = 400;
    throw err;
  }
  const id = newLedgerId();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const data = {
    id,
    name,
    ownerId: input.uid,
    currency: text(input.currency) || "INR",
    createdAt: now,
    roles: { [input.uid]: { role: "owner", email: text(input.email).toLowerCase() } }
  };
  await ledgerSet(`books/${id}`, data);
  await ledgerAudit({
    bookId: id,
    actorUid: input.uid,
    actorEmail: input.email,
    action: "ledger.create",
    entityType: "book",
    entityId: id,
    detail: { name }
  });
  const mailbox = await ledgerEnsureMailbox(id, data).catch(() => null);
  return {
    ...data,
    inboundAddress: mailbox && typeof mailbox === "object" ? text(mailbox.address) : "",
    inboundSlug: mailbox && typeof mailbox === "object" ? text(mailbox.slug) : ""
  };
}
async function ledgerUpdateBook(bookId, uid, patch) {
  const current = await ledgerGetBookForUser(bookId, uid);
  const next = { ...current, ...patch, id: bookId };
  if (patch.roles && typeof patch.roles === "object") next.roles = patch.roles;
  await ledgerSet(`books/${bookId}`, next);
  await ledgerAudit({
    bookId,
    actorUid: uid,
    action: "ledger.update",
    entityType: "book",
    entityId: bookId
  });
  return next;
}
async function ledgerRemoveMember(bookId, actorUid, uidToRemove) {
  const book = await ledgerGetBookForUser(bookId, actorUid);
  const roles = rolesOf(book.roles);
  if (!roles[uidToRemove]) {
    const err = new Error("Member not found");
    err.status = 404;
    throw err;
  }
  if (roles[uidToRemove]?.role === "owner") {
    const owners = Object.values(roles).filter((row) => row?.role === "owner").length;
    if (owners <= 1) {
      const err = new Error("You cannot remove the last owner of the ledger.");
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
    action: "ledger.remove_member",
    entityType: "book",
    entityId: bookId,
    detail: { uidToRemove }
  });
  return next;
}
async function ledgerSoftDeleteBook(bookId, uid) {
  await ledgerRequireManager(bookId, uid);
  const current = asObject(await ledgerGet(`books/${bookId}`)) || {};
  const next = {
    ...current,
    deleted: true,
    deletedAt: (/* @__PURE__ */ new Date()).toISOString(),
    deletedBy: uid,
    status: "deleted"
  };
  await ledgerSet(`books/${bookId}`, next);
  await ledgerAudit({
    bookId,
    actorUid: uid,
    action: "ledger.soft_delete",
    entityType: "book",
    entityId: bookId
  });
  return next;
}
async function ledgerLiveExpenseByHash(bookId, hash) {
  const value = text(hash);
  if (!value) return null;
  const sql = await getLedgerSql();
  const rows = asRows(
    await sql`
      SELECT id, data FROM expenses
      WHERE book_id = ${bookId} AND deleted = false AND receipt_hash = ${value}
      LIMIT 1
    `
  );
  const row = rows[0];
  const data = row ? asObject(row.data) : null;
  if (!row || !data || flag(data)) return null;
  return { id: String(row.id), ...data };
}
async function ledgerListLiveExpenses(bookId) {
  const rows = await ledgerList(`books/${bookId}/expenses`);
  return rows.map((row) => ({ id: row.id, ...row.data }));
}
async function ledgerGetExpense(bookId, expenseId) {
  const data = asObject(await ledgerGet(`books/${bookId}/expenses/${expenseId}`));
  if (!data || flag(data)) return null;
  return { id: expenseId, ...data };
}
async function ledgerSaveExpense(bookId, expense, opts) {
  const id = text(expense.id) || newLedgerId();
  const row = { ...expense, id };
  try {
    const wrote = await ledgerSet(`books/${bookId}/expenses/${id}`, row, Boolean(opts?.insertOnly));
    if (opts?.insertOnly && !wrote) {
      const existing = asObject(await ledgerGet(`books/${bookId}/expenses/${id}`));
      return { expense: { id, ...existing || row }, created: false };
    }
  } catch (err) {
    if (ledgerUniqueViolation(err)) {
      const existing = await ledgerLiveExpenseByHash(bookId, text(row.receiptHash));
      const dup = new Error("This receipt is already recorded");
      dup.status = 409;
      dup.existing = existing;
      throw dup;
    }
    throw err;
  }
  return { expense: row, created: true };
}
async function ledgerSoftDeleteExpense(bookId, expenseId, uid) {
  const current = asObject(await ledgerGet(`books/${bookId}/expenses/${expenseId}`));
  if (!current || flag(current)) return false;
  const next = {
    ...current,
    id: expenseId,
    deleted: true,
    deletedAt: (/* @__PURE__ */ new Date()).toISOString(),
    deletedBy: uid,
    status: "deleted"
  };
  await ledgerSet(`books/${bookId}/expenses/${expenseId}`, next);
  return true;
}
async function ledgerListNotifications(userId) {
  const rows = await ledgerList("notifications", [{ type: "where", field: "userId", op: "==", value: userId }]);
  return rows.filter((row) => text(row.data.userId) === userId && !flag(row.data)).map((row) => ({ id: row.id, ...row.data }));
}
async function ledgerAddNotification(data) {
  const id = text(data.id) || newLedgerId();
  const row = {
    ...data,
    id,
    userId: text(data.userId),
    createdAt: text(data.createdAt) || (/* @__PURE__ */ new Date()).toISOString(),
    read: Boolean(data.read)
  };
  await ledgerSet(`notifications/${id}`, row);
  return row;
}
async function ledgerMarkNotificationRead(id, userId) {
  const current = asObject(await ledgerGet(`notifications/${id}`));
  if (!current) return null;
  if (text(current.userId) !== userId) {
    const err = new Error("Notification not found");
    err.status = 404;
    throw err;
  }
  const next = { ...current, read: true };
  await ledgerSet(`notifications/${id}`, next);
  return { id, ...next };
}
async function ledgerGetUser(uid) {
  return asObject(await ledgerGet(`users/${uid}`));
}
async function ledgerUpsertUser(uid, patch, merge = true) {
  const current = await ledgerGetUser(uid) || {};
  const next = merge ? { ...current, ...patch, uid } : { ...patch, uid };
  await ledgerSet(`users/${uid}`, next);
  return next;
}
async function ledgerListMailEvents(bookId) {
  const [inbound, outbound] = await Promise.all([
    ledgerList(`books/${bookId}/inbound_events`),
    ledgerList(`books/${bookId}/email_events`)
  ]);
  return {
    inbound: inbound.map((row) => ({ id: row.id, direction: "inbound", ...row.data })),
    outbound: outbound.map((row) => ({ id: row.id, direction: "outbound", ...row.data }))
  };
}
async function ledgerAddEmailEvent(bookId, data) {
  const id = text(data.id) || newLedgerId();
  const row = { ...data, id, createdAt: text(data.createdAt) || (/* @__PURE__ */ new Date()).toISOString() };
  await ledgerSet(`books/${bookId}/email_events/${id}`, row);
  return row;
}
const FIREBASE_PROJECT = "gen-lang-client-0616065043";
const jwtMem = /* @__PURE__ */ new Map();
let jwks = null;
class ApiError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}
function applyApiCors(req, res) {
  const origin = String(req.headers.origin || "");
  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  if (origin) res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
}
function apiJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(payload));
}
function readApiBody(req) {
  const raw = req.body;
  if (typeof raw === "string") return JSON.parse(raw || "{}");
  if (raw && typeof raw === "object") return raw;
  return {};
}
async function verifyFirebaseUser(token) {
  const hit = jwtMem.get(token);
  if (hit && hit.exp > Date.now() + 5e3) return { uid: hit.uid, email: hit.email };
  const { createRemoteJWKSet, jwtVerify } = await import("jose");
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));
  }
  const { payload } = await jwtVerify(token, jwks, {
    issuer: `https://securetoken.google.com/${FIREBASE_PROJECT}`,
    audience: FIREBASE_PROJECT
  });
  const uid = String(payload.user_id || payload.sub || "");
  const email = String(payload.email || "").trim().toLowerCase();
  const exp = Number(payload.exp || 0) * 1e3 || Date.now() + 5e4;
  if (!uid) return null;
  jwtMem.set(token, { uid, email, exp });
  if (jwtMem.size > 300) jwtMem.clear();
  return { uid, email };
}
async function requireApiUser(req, res) {
  const header = String(req.headers.authorization || "");
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  let user = null;
  try {
    user = token ? await verifyFirebaseUser(token) : null;
  } catch {
    user = null;
  }
  if (!user) {
    apiJson(res, 401, { error: "Sign in required" });
    return null;
  }
  return user;
}
function handleApiError(res, err) {
  const e = err;
  const status = Number(e?.status || 500) || 500;
  apiJson(res, status, { error: e?.message || "Request failed", ...e?.extra || {} });
}
async function withDomainApi(req, res, fn) {
  try {
    applyApiCors(req, res);
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }
    if (req.method !== "POST") {
      apiJson(res, 405, { error: "POST required" });
      return;
    }
    const user = await requireApiUser(req, res);
    if (!user) return;
    await fn(user, readApiBody(req));
  } catch (err) {
    handleApiError(res, err);
  }
}
export {
  ApiError,
  apiJson,
  applyApiCors,
  asObject,
  cleanPath,
  getLedgerSql,
  handleApiError,
  inboundMailboxSlug,
  ledgerAddEmailEvent,
  ledgerAddNotification,
  ledgerAudit,
  ledgerCreateBook,
  ledgerDel,
  ledgerEnsureMailbox,
  ledgerGet,
  ledgerGetBookForUser,
  ledgerGetExpense,
  ledgerGetUser,
  ledgerInsertIfNew,
  ledgerList,
  ledgerListBooksForUser,
  ledgerListExpensesByBooks,
  ledgerListLiveExpenses,
  ledgerListMailEvents,
  ledgerListNotifications,
  ledgerLiveExpenseByHash,
  ledgerMarkNotificationRead,
  ledgerMember,
  ledgerRemoveMember,
  ledgerRequireManager,
  ledgerRequireMember,
  ledgerRequireWriter,
  ledgerResolveInboundSlug,
  ledgerSaveExpense,
  ledgerSet,
  ledgerSoftDeleteBook,
  ledgerSoftDeleteExpense,
  ledgerUniqueViolation,
  ledgerUpdateBook,
  ledgerUpsertUser,
  newLedgerId,
  postgresUrl,
  requireApiUser,
  verifyFirebaseUser,
  withDomainApi
};

-- Byjan / Expense Tracker — Neon schema
-- Ledgers live in real tables. R2 is for receipt files only.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT,
  display_name TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  owner_id TEXT,
  currency TEXT DEFAULT 'INR',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS book_members (
  book_id TEXT NOT NULL,
  uid TEXT NOT NULL,
  role TEXT NOT NULL,
  email TEXT,
  PRIMARY KEY (book_id, uid)
);
CREATE INDEX IF NOT EXISTS book_members_uid_idx ON book_members (uid);

CREATE TABLE IF NOT EXISTS expenses (
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
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS expenses_book_idx ON expenses (book_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS expenses_book_amount_idx ON expenses (book_id, amount);

CREATE TABLE IF NOT EXISTS inbound_events (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  status TEXT,
  from_email TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS inbound_events_book_idx ON inbound_events (book_id, created_at DESC);

CREATE TABLE IF NOT EXISTS email_events (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY,
  email TEXT,
  book_id TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inbound_hashes (
  book_id TEXT NOT NULL,
  hash TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (book_id, hash)
);

CREATE TABLE IF NOT EXISTS inbound_bills (
  book_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (book_id, fingerprint)
);

CREATE TABLE IF NOT EXISTS inbound_mailboxes (
  book_id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inbound_aliases (
  slug TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inbound_pending (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inbound_seen (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Leftover / ERP / hydrate markers only
CREATE TABLE IF NOT EXISTS documents (
  path TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Example queries:
-- SELECT * FROM expenses WHERE description ILIKE '%basha%' AND amount = 500;
-- SELECT * FROM inbound_events WHERE book_id = '...' ORDER BY created_at DESC;

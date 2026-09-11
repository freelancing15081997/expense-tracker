-- Byjan / Expense Tracker — Neon schema
-- Paste this first in Neon → SQL Editor → Run.
-- One table holds every document (ledgers, entries, users, mail events).

CREATE TABLE IF NOT EXISTS documents (
  path TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS documents_path_idx ON documents (path);
CREATE INDEX IF NOT EXISTS documents_updated_at_idx ON documents (updated_at);

-- Path examples after import:
--   users/{uid}
--   books/{bookId}
--   books/{bookId}/expenses/{expenseId}
--   books/{bookId}/inbound_events/{id}
--   books/{bookId}/email_events/{id}
--   notifications/{id}
--   invites/{id}
--   inbound_hashes/{bookId}/{hash}
--   erp_workspaces/{id}/meta/pack

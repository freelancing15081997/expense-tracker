import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes } from 'node:crypto';
import {
  ApiError,
  apiJson,
  ledgerAudit,
  ledgerFindDuplicateExpense,
  ledgerGetBookForUser,
  ledgerListLiveExpenses,
  ledgerRequireMember,
  ledgerRequireWriter,
  ledgerSaveExpense,
  withDomainApi,
  getLedgerSql,
} from '../_pg-tables.js';

async function ensureMoneySchema() {
  const sql = await getLedgerSql();
  await sql`CREATE TABLE IF NOT EXISTS idempotency_records (
    key TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    uid TEXT NOT NULL,
    response JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idempotency_book_idx ON idempotency_records (book_id, uid, created_at DESC)`;
  await sql`CREATE TABLE IF NOT EXISTS capture_events (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    uid TEXT NOT NULL,
    processing_status TEXT NOT NULL DEFAULT 'INGESTED',
    financial_status TEXT NOT NULL DEFAULT 'DRAFT',
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS capture_events_book_idx ON capture_events (book_id, updated_at DESC)`;
}

function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${randomBytes(3).toString('hex')}`;
}

async function getIdempotent(key: string, bookId: string, uid: string) {
  if (!key) return null;
  await ensureMoneySchema();
  const sql = await getLedgerSql();
  const rows = await sql`SELECT response FROM idempotency_records WHERE key = ${key} AND book_id = ${bookId} AND uid = ${uid} LIMIT 1`;
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row || !row.response) return null;
  return row.response as Record<string, unknown>;
}

async function putIdempotent(key: string, bookId: string, uid: string, response: Record<string, unknown>) {
  if (!key) return;
  await ensureMoneySchema();
  const sql = await getLedgerSql();
  await sql`
    INSERT INTO idempotency_records (key, book_id, uid, response, created_at)
    VALUES (${key}, ${bookId}, ${uid}, ${JSON.stringify(response)}::jsonb, NOW())
    ON CONFLICT (key) DO NOTHING
  `;
}

function parseAmountFromText(text: string) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim();
  if (!raw) return null;
  const inMatch = raw.match(/\b(?:credited|received|money in|salary)\b/i);
  const outMatch = raw.match(/\b(?:debited|paid|spent|sent to|money out)\b/i);
  const transferMatch = raw.match(/\btransfer\b/i);
  const amtMatch = raw.match(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s*(?:₹|rs\.?|inr)/i)
    || raw.match(/\b(?:amt|amount|rs)\s*[:\-]?\s*([\d,]+(?:\.\d{1,2})?)/i)
    || raw.match(/\b([\d,]{2,}(?:\.\d{1,2})?)\b/);
  const amount = Number(String(amtMatch?.[1] || amtMatch?.[2] || '0').replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  let entryType = 'out';
  if (inMatch && !outMatch) entryType = 'in';
  else if (transferMatch) entryType = 'transfer';
  const merchant = raw.match(/\b(?:to|at|from|paid to|received from)\s+([A-Za-z0-9 .&'-]{2,40})/i)?.[1]?.trim() || '';
  return {
    amount,
    entryType,
    description: merchant || raw.slice(0, 80),
    merchant,
    paymentMethod: /\bupi\b/i.test(raw) ? 'upi' : /\bcard\b/i.test(raw) ? 'card' : 'cash',
    date: new Date().toISOString().slice(0, 10),
  };
}

export async function handleMoney(req: VercelRequest, res: VercelResponse) {
  await withDomainApi(req, res, async (user, body) => {
    const op = String(body.op || '');

    if (op === 'parseCapture') {
      const bookId = String(body.bookId || '').trim();
      const text = String(body.text || '');
      if (!bookId) throw new ApiError(400, 'Missing ledger');
      await ledgerRequireMember(bookId, user.uid);
      const parsed = parseAmountFromText(text);
      const preview = parsed ? {
        id: newId('cap'),
        source: String(body.source || 'sms'),
        direction: parsed.entryType === 'in' ? 'MONEY_IN' : parsed.entryType === 'transfer' ? 'TRANSFER' : 'MONEY_OUT',
        amountPaise: Math.round(parsed.amount * 100),
        description: parsed.description,
        merchant: parsed.merchant,
        category: 'Uncategorized',
        paymentMethod: parsed.paymentMethod,
        date: parsed.date,
        processingStatus: parsed.amount > 0 ? 'READY' : 'REVIEW_REQUIRED',
        financialStatus: 'DRAFT',
        confidence: parsed.amount > 0 ? 'medium' : 'low',
        reasons: ['Server-side parse'],
        raw: text,
      } : {
        id: newId('cap'),
        source: String(body.source || 'sms'),
        direction: 'UNKNOWN',
        amountPaise: 0,
        description: text.slice(0, 120) || 'Needs review',
        processingStatus: 'REVIEW_REQUIRED',
        financialStatus: 'DRAFT',
        confidence: 'low',
        reasons: ['Could not parse amount'],
        raw: text,
      };
      apiJson(res, 200, { preview });
      return;
    }

    if (op === 'saveCapture') {
      const bookId = String(body.bookId || '').trim();
      const preview = body.preview && typeof body.preview === 'object' ? body.preview as Record<string, unknown> : {};
      if (!bookId) throw new ApiError(400, 'Missing ledger');
      await ledgerRequireMember(bookId, user.uid);
      await ensureMoneySchema();
      const id = String(preview.id || newId('cap'));
      const sql = await getLedgerSql();
      await sql`
        INSERT INTO capture_events (id, book_id, uid, processing_status, financial_status, data, created_at, updated_at)
        VALUES (
          ${id}, ${bookId}, ${user.uid},
          ${String(preview.processingStatus || 'INGESTED')},
          ${String(preview.financialStatus || 'DRAFT')},
          ${JSON.stringify(preview)}::jsonb, NOW(), NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          processing_status = EXCLUDED.processing_status,
          financial_status = EXCLUDED.financial_status,
          data = EXCLUDED.data,
          updated_at = NOW()
      `;
      apiJson(res, 200, { event: { ...preview, id } });
      return;
    }

    if (op === 'confirmCapture') {
      const bookId = String(body.bookId || '').trim();
      const preview = body.preview && typeof body.preview === 'object' ? body.preview as Record<string, unknown> : {};
      const idempotencyKey = String(body.idempotencyKey || preview.id || '').trim();
      if (!bookId) throw new ApiError(400, 'Missing ledger');
      await ledgerRequireWriter(bookId, user.uid);

      const cached = await getIdempotent(idempotencyKey, bookId, user.uid);
      if (cached?.expense) {
        apiJson(res, 200, { expense: cached.expense, idempotent: true });
        return;
      }

      const amount = Number(preview.amountPaise || 0) / 100 || Number(preview.amount || 0);
      const entryType = preview.direction === 'MONEY_IN' ? 'in' : preview.direction === 'TRANSFER' ? 'transfer' : 'out';
      const input = {
        amount,
        description: String(preview.description || 'Entry'),
        merchant: String(preview.merchant || ''),
        category: String(preview.category || 'Uncategorized'),
        entryType,
        paymentMethod: String(preview.paymentMethod || 'cash'),
        date: String(preview.date || new Date().toISOString().slice(0, 10)),
        upiRef: String(preview.upiRef || ''),
        vpa: String(preview.vpa || ''),
        captureId: String(preview.id || ''),
        captureSource: String(preview.source || 'manual'),
        processingStatus: 'COMPLETED',
        financialStatus: 'CONFIRMED',
        status: amount > 0 ? 'recorded' : 'draft',
      };

      if (!body.force) {
        const matches = await ledgerFindDuplicateExpense(bookId, input);
        if (matches.length) throw new ApiError(409, 'A matching entry is already on this ledger', { matches });
      }

      const now = new Date().toISOString();
      const saved = await ledgerSaveExpense(bookId, {
        ...input,
        enteredByUid: user.uid,
        enteredByEmail: user.email,
        createdAt: now,
      }, { insertOnly: true });

      await ledgerAudit({
        bookId,
        actorUid: user.uid,
        actorEmail: user.email,
        action: 'expense.capture_confirm',
        entityType: 'expense',
        entityId: String(saved.expense.id),
        detail: { captureId: preview.id, source: preview.source },
      });

      const response = { expense: saved.expense };
      await putIdempotent(idempotencyKey, bookId, user.uid, response);
      apiJson(res, 200, response);
      return;
    }

    if (op === 'nlSearch' || op === 'reportSummary') {
      const bookId = String(body.bookId || '').trim();
      const bookIds = Array.isArray(body.bookIds) ? body.bookIds.map(String) : bookId ? [bookId] : [];
      if (!bookIds.length) throw new ApiError(400, 'Missing ledger');
      for (const id of bookIds) await ledgerRequireMember(id, user.uid);

      const all: Array<Record<string, unknown>> = [];
      for (const id of bookIds) {
        const rows = await ledgerListLiveExpenses(id);
        all.push(...rows.map((row) => ({ ...row, bookId: id })));
      }

      if (op === 'nlSearch') {
        const query = String(body.query || '').toLowerCase();
        const filtered = all.filter((exp) => {
          const hay = `${exp.description || ''} ${exp.merchant || ''} ${exp.category || ''}`.toLowerCase();
          return !query || hay.includes(query);
        });
        apiJson(res, 200, { expenses: filtered.slice(0, 200) });
        return;
      }

      let outPaise = 0;
      let inPaise = 0;
      for (const exp of all) {
        const paise = Math.round(Number(exp.amount || 0) * 100);
        const t = String(exp.entryType || 'out');
        if (t === 'in') inPaise += paise;
        else if (t !== 'transfer') outPaise += paise;
      }
      apiJson(res, 200, {
        summary: {
          moneyOut: outPaise / 100,
          moneyIn: inPaise / 100,
          net: (inPaise - outPaise) / 100,
          count: all.length,
        },
      });
      return;
    }

    throw new ApiError(400, 'Unknown money operation');
  });
}

export async function checkExpenseIdempotency(bookId: string, uid: string, key: string) {
  return getIdempotent(key, bookId, uid);
}

export async function storeExpenseIdempotency(bookId: string, uid: string, key: string, response: Record<string, unknown>) {
  return putIdempotent(key, bookId, uid, response);
}

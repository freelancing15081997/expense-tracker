import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes } from 'node:crypto';
import {
  ApiError,
  apiJson,
  ledgerAudit,
  ledgerFindDuplicateExpense,
  ledgerGetBookForUser,
  ledgerListBooksForUser,
  ledgerListLiveExpenses,
  ledgerListAudit,
  ledgerRequireMember,
  ledgerRequireWriter,
  ledgerSaveExpense,
  ledgerGetUser,
  withDomainApi,
  getLedgerSql,
} from '../_pg-tables.js';
import {
  confirmSettlementReceived,
  createSettlementsFromSplit,
  ensureSettlementSchema,
  getBookMemberUpiProfiles,
  listMyOpenSettlements,
  listSettlementsForBook,
  markSettlementReview,
  reportUpiReturn,
  requestMemberUpi,
  saveMyUpiProfile,
  startUpiPayment,
} from './settlement-upi.js';
import { extractMoneyAmount, ocrFingerprint, reconcileVisionAmount } from './amount-parse.js';
import { validateSplitPayload } from './split-validate.js';

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
  await sql`CREATE TABLE IF NOT EXISTS role_permissions (
    role_key TEXT PRIMARY KEY,
    features JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`ALTER TABLE capture_events ADD COLUMN IF NOT EXISTS flow_state TEXT`;
  await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS split_data JSONB`;
  await sql`CREATE TABLE IF NOT EXISTS parse_feedback (
    id TEXT PRIMARY KEY,
    uid TEXT NOT NULL,
    book_id TEXT,
    fingerprint TEXT NOT NULL,
    ocr_text TEXT NOT NULL DEFAULT '',
    predicted JSONB NOT NULL DEFAULT '[]'::jsonb,
    gold JSONB,
    saved BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS parse_feedback_fp_idx ON parse_feedback (fingerprint, created_at DESC)`;
  await sql`CREATE TABLE IF NOT EXISTS parse_overrides (
    fingerprint TEXT PRIMARY KEY,
    amount DOUBLE PRECISION NOT NULL,
    merchant TEXT NOT NULL DEFAULT '',
    extras JSONB NOT NULL DEFAULT '[]'::jsonb,
    sample_count INT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await ensureSettlementSchema();
}

function flowCopy(state: string) {
  const map: Record<string, { title: string; detail: string }> = {
    RECEIVED: { title: 'Receipt received', detail: 'Let’s make sense of it.' },
    VALIDATING: { title: 'Checking the file', detail: 'Making sure this is a usable receipt.' },
    BOOK_SELECTED: { title: 'Money book ready', detail: 'Choosing where this belongs.' },
    EXTRACTING: { title: 'Reading your receipt', detail: 'Looking for merchant, amount and date…' },
    CLASSIFYING: { title: 'Understanding the expense', detail: 'Finding the best category…' },
    DUPLICATE_CHECK: { title: 'Checking for duplicates', detail: 'Making sure you don’t get charged twice.' },
    READY: { title: 'Ready to save', detail: 'Everything looks clear.' },
    CREATED: { title: 'Expense created', detail: 'Updating your Money data…' },
    COMPLETED: { title: 'All set', detail: 'Your Money book is up to date.' },
    FAILED: { title: 'Couldn’t finish', detail: 'Your receipt is safe. Nothing was added twice.' },
    RETRYING: { title: 'Trying again', detail: 'One more pass on this receipt.' },
    AWAITING_CONTEXT: { title: 'Choose a Money book', detail: 'Pick where this expense should live.' },
    REVIEW_REQUIRED: { title: 'Quick check needed', detail: 'Only the unclear fields — then you’re done.' },
  };
  return map[state] || { title: state, detail: '' };
}

function scoreContext(book: Record<string, unknown>, hints: { merchant?: string; category?: string; text?: string }) {
  let score = 10;
  const reasons: string[] = [];
  const name = String(book.name || '').toLowerCase();
  const hay = `${hints.merchant || ''} ${hints.category || ''} ${hints.text || ''}`.toLowerCase();
  if (name && hay.includes(name.split(' ')[0])) {
    score += 40;
    reasons.push('Name matches receipt context');
  }
  const roles = book.roles && typeof book.roles === 'object' ? Object.keys(book.roles as object).length : 1;
  if (roles === 1) {
    score += 15;
    reasons.push('Personal book');
  }
  if (!reasons.length) reasons.push('Authorized Money book');
  return { score, reason: reasons[0] };
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

async function parseAmountFromText(text: string) {
  const learned = await lookupParseOverride(text);
  if (learned && learned.amount > 0) {
    return {
      amount: learned.amount,
      entryType: 'out' as const,
      description: learned.merchant || 'Learned from mismatch',
      merchant: learned.merchant,
      paymentMethod: 'upi',
      date: new Date().toISOString().slice(0, 10),
      confidence: 'high' as const,
      score: 99,
    };
  }
  const parsed = extractMoneyAmount(text);
  if (!parsed) return null;
  return {
    amount: parsed.amount,
    entryType: parsed.entryType,
    description: parsed.description,
    merchant: parsed.merchant,
    paymentMethod: parsed.paymentMethod,
    date: parsed.date,
    confidence: parsed.confidence,
    score: parsed.score,
  };
}

function sanitizeGold(raw: unknown): { amount: number; merchant: string; extras: Array<{ amount: number; merchant: string; entryType?: string }> } | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const amount = Number(o.amount || 0);
  if (!(amount > 0) || amount >= 100_000_000) return null;
  const extrasIn = Array.isArray(o.extras) ? o.extras : [];
  const extras = extrasIn
    .map((row) => {
      const e = row && typeof row === 'object' ? row as Record<string, unknown> : {};
      const a = Number(e.amount || 0);
      if (!(a > 0) || a >= 100_000_000) return null;
      return {
        amount: a,
        merchant: String(e.merchant || '').slice(0, 80),
        entryType: e.entryType === 'in' ? 'in' : 'out',
      };
    })
    .filter((e): e is { amount: number; merchant: string; entryType: string } => Boolean(e));
  return {
    amount,
    merchant: String(o.merchant || '').slice(0, 80),
    extras,
  };
}

async function upsertParseOverride(fingerprint: string, gold: NonNullable<ReturnType<typeof sanitizeGold>>) {
  if (!fingerprint) return;
  const sql = await getLedgerSql();
  await sql`
    INSERT INTO parse_overrides (fingerprint, amount, merchant, extras, sample_count, updated_at)
    VALUES (
      ${fingerprint}, ${gold.amount}, ${gold.merchant},
      ${JSON.stringify(gold.extras)}::jsonb, 1, NOW()
    )
    ON CONFLICT (fingerprint) DO UPDATE SET
      amount = EXCLUDED.amount,
      merchant = EXCLUDED.merchant,
      extras = EXCLUDED.extras,
      sample_count = parse_overrides.sample_count + 1,
      updated_at = NOW()
  `;
}

async function lookupParseOverride(text: string) {
  const fp = ocrFingerprint(text);
  if (!fp) return null;
  try {
    const sql = await getLedgerSql();
    const rows = await sql`SELECT amount, merchant, extras FROM parse_overrides WHERE fingerprint = ${fp} LIMIT 1`;
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row || !(Number(row.amount) > 0)) return null;
    return {
      amount: Number(row.amount),
      merchant: String(row.merchant || ''),
      extras: Array.isArray(row.extras) ? row.extras : [],
    };
  } catch {
    return null;
  }
}

export async function handleMoney(req: VercelRequest, res: VercelResponse) {
  await withDomainApi(req, res, async (user, body) => {
    const op = String(body.op || '');

    if (op === 'parseCapture') {
      const bookId = String(body.bookId || '').trim();
      const text = String(body.text || '');
      if (!bookId) throw new ApiError(400, 'Missing ledger');
      await ledgerRequireMember(bookId, user.uid);
      const parsed = await parseAmountFromText(text);
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

    if (op === 'reportMismatch' || op === 'confirmMismatchGold') {
      const ocrText = String(body.ocrText || '').slice(0, 8000);
      const fingerprint = String(body.fingerprint || ocrFingerprint(ocrText)).slice(0, 160);
      if (!ocrText.trim() || !fingerprint) throw new ApiError(400, 'Nothing to learn from');
      await ensureMoneySchema();
      const sql = await getLedgerSql();
      const gold = sanitizeGold(body.gold);
      const predicted = Array.isArray(body.predicted)
        ? (body.predicted as unknown[]).slice(0, 12).map((row) => {
          const e = row && typeof row === 'object' ? row as Record<string, unknown> : {};
          return {
            amount: Number(e.amount || 0),
            merchant: String(e.merchant || '').slice(0, 80),
          };
        })
        : [];
      const bookId = String(body.bookId || '').trim();
      let id = String(body.id || '').trim();
      if (op === 'reportMismatch' || !id) {
        id = id || newId('mm');
        await sql`
          INSERT INTO parse_feedback (id, uid, book_id, fingerprint, ocr_text, predicted, gold, saved, created_at, updated_at)
          VALUES (
            ${id}, ${user.uid}, ${bookId || null}, ${fingerprint}, ${ocrText},
            ${JSON.stringify(predicted)}::jsonb, ${gold ? JSON.stringify(gold) : null}::jsonb,
            false, NOW(), NOW()
          )
          ON CONFLICT (id) DO UPDATE SET
            ocr_text = EXCLUDED.ocr_text,
            predicted = EXCLUDED.predicted,
            gold = COALESCE(EXCLUDED.gold, parse_feedback.gold),
            updated_at = NOW()
        `;
      } else {
        await sql`
          UPDATE parse_feedback SET
            gold = ${gold ? JSON.stringify(gold) : null}::jsonb,
            saved = ${Boolean(body.saved)},
            updated_at = NOW()
          WHERE id = ${id} AND uid = ${user.uid}
        `;
      }
      if (gold) await upsertParseOverride(fingerprint, gold);
      apiJson(res, 200, { id, learned: Boolean(gold) });
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
      const now = new Date().toISOString();
      const paidDate = String(preview.paidAt || preview.date || now.slice(0, 10)).slice(0, 10);
      const receiptHash = preview.receiptHash ? String(preview.receiptHash) : undefined;
      const input = {
        amount,
        description: String(preview.description || 'Entry'),
        merchant: String(preview.merchant || ''),
        category: String(preview.category || 'Uncategorized'),
        entryType,
        paymentMethod: String(preview.paymentMethod || 'cash'),
        date: paidDate,
        paidAt: paidDate,
        upiRef: String(preview.upiRef || ''),
        vpa: String(preview.vpa || ''),
        captureId: String(preview.id || ''),
        captureSource: String(preview.source || 'manual'),
        receiptPath: preview.receiptPath ? String(preview.receiptPath) : undefined,
        receiptName: preview.receiptName ? String(preview.receiptName) : undefined,
        receiptHash,
        processingStatus: 'COMPLETED',
        financialStatus: 'CONFIRMED',
        status: amount > 0 ? 'recorded' : 'draft',
      };

      if (!body.force) {
        const matches = await ledgerFindDuplicateExpense(bookId, {
          ...input,
          receiptHash,
          upiRef: input.upiRef,
        });
        if (matches.length) throw new ApiError(409, 'A matching entry is already on this ledger', { matches });
      }

      const saved = await ledgerSaveExpense(bookId, {
        ...input,
        enteredByUid: user.uid,
        enteredByEmail: user.email,
        createdAt: now,
        ...(body.force ? { duplicateConfirmedDifferent: true } : {}),
      }, { insertOnly: true, allowDuplicateHash: Boolean(body.force) });

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
      try {
        const book = await ledgerGetBookForUser(bookId, user.uid);
        const roles = book.roles && typeof book.roles === 'object' && !Array.isArray(book.roles)
          ? book.roles as Record<string, unknown>
          : {};
        const uids = new Set(Object.keys(roles).filter(Boolean));
        if (book.ownerId) uids.add(String(book.ownerId));
        uids.delete(user.uid);
        if (uids.size) {
          const { sendFcm } = await import('./fcm.js');
          const bookName = String(book.name || 'Byjan');
          const desc = String(saved.expense.description || saved.expense.merchant || 'an entry');
          await Promise.all([...uids].map(async (uid) => {
            const profile = await ledgerGetUser(uid);
            const token = String(profile?.pushToken || '').trim();
            if (!token) return;
            await sendFcm(token, {
              title: bookName,
              body: `${user.email || 'A teammate'} added ${desc}`,
              data: { bookId, url: `/#/book/${bookId}`, kind: 'entry' },
            });
          }));
        }
      } catch (err) {
        console.error('capture FCM failed', err);
      }
      apiJson(res, 200, response);
      return;
    }

    if (op === 'rankContexts') {
      const hints = {
        merchant: String(body.merchant || ''),
        category: String(body.category || ''),
        text: String(body.text || ''),
      };
      const books = await ledgerListBooksForUser(user.uid);
      const contexts = (books || [])
        .filter((b: Record<string, unknown>) => !b.deleted && !b.deletedAt)
        .map((b: Record<string, unknown>) => {
          const ranked = scoreContext(b, hints);
          return {
            id: String(b.id),
            name: String(b.name || 'Money book'),
            currency: String(b.currency || 'INR'),
            score: ranked.score,
            reason: ranked.reason,
            memberCount: b.roles && typeof b.roles === 'object' ? Object.keys(b.roles as object).length : 1,
          };
        })
        .sort((a, b) => b.score - a.score);
      apiJson(res, 200, {
        contexts,
        autoSelectId: contexts.length === 1 ? contexts[0].id : (contexts[0]?.score >= 50 ? contexts[0].id : null),
      });
      return;
    }

    if (op === 'processReceipt') {
      const bookId = String(body.bookId || '').trim();
      const text = String(body.text || '');
      const receiptPath = body.receiptPath ? String(body.receiptPath) : '';
      const receiptName = body.receiptName ? String(body.receiptName) : '';
      const idempotencyKey = String(body.idempotencyKey || '').trim() || newId('rcpt');
      const source = String(body.source || 'receipt');

      if (!bookId) {
        apiJson(res, 200, {
          flowState: 'AWAITING_CONTEXT',
          copy: flowCopy('AWAITING_CONTEXT'),
          preview: null,
        });
        return;
      }
      await ledgerRequireWriter(bookId, user.uid);
      await ensureMoneySchema();

      const cached = await getIdempotent(idempotencyKey, bookId, user.uid);
      if (cached?.expense) {
        apiJson(res, 200, { ...cached, flowState: 'COMPLETED', copy: flowCopy('COMPLETED'), idempotent: true });
        return;
      }

      const timeline: Array<Record<string, unknown>> = [];
      const push = (kind: string, state: string) => {
        const copy = flowCopy(state);
        timeline.push({ id: newId('ev'), at: new Date().toISOString(), kind, title: copy.title, detail: copy.detail, state });
      };

      push('receipt.received', 'RECEIVED');
      push('receipt.validating', 'VALIDATING');
      const imageBase64 = String(body.imageBase64 || body.imageDataBase64 || '')
        .replace(/^data:[^;]+;base64,/i, '')
        .replace(/\s+/g, '');
      const imageMime = String(body.imageMime || body.mimeType || 'image/jpeg').split(';')[0].trim() || 'image/jpeg';
      if (!text && !receiptPath && !imageBase64) {
        apiJson(res, 200, { flowState: 'FAILED', copy: flowCopy('FAILED'), timeline, error: 'No receipt content' });
        return;
      }
      push('receipt.book_selected', 'BOOK_SELECTED');
      push('receipt.extracting', 'EXTRACTING');

      let docText = text;
      const isPdfDoc = imageMime === 'application/pdf' || /\.pdf$/i.test(receiptName);
      const { extractPdfText } = await import('./pdf-text.js');
      let pdfLayer = '';
      if (isPdfDoc && imageBase64.length > 64) {
        try {
          pdfLayer = await extractPdfText(Buffer.from(imageBase64, 'base64'));
        } catch {
          pdfLayer = '';
        }
      }
      // Share skips Gemini — still read the stored PDF. Do not skip just because OCR said "amount".
      if (isPdfDoc && receiptPath && !pdfLayer) {
        try {
          const { r2FileKey, r2GetBytes } = await import('./r2.js');
          const file = await r2GetBytes(r2FileKey(String(receiptPath)));
          if (file?.body?.length) {
            pdfLayer = await extractPdfText(file.body);
          }
        } catch {
          // Keep OCR/hint text.
        }
      }
      if (pdfLayer) {
        const pdfParsed = await parseAmountFromText(pdfLayer);
        if (pdfParsed && pdfParsed.amount > 0) {
          // CRED / invoices: PDF text layer is the amount source of truth. OCR of ₹ → 4 must not mix in.
          docText = pdfLayer;
        } else {
          docText = [docText, pdfLayer].filter(Boolean).join('\n').slice(0, 16_000);
        }
      }

      const { isSpreadsheetMime, parseSpreadsheetBuffer } = await import('./excel-ledger.js');
      if (isSpreadsheetMime(imageMime, receiptName) && imageBase64 && imageBase64.length > 64) {
        const sheet = await parseSpreadsheetBuffer({
          base64: imageBase64,
          mimeType: imageMime,
          fileName: receiptName,
        });
        if (!sheet.rows.length) {
          apiJson(res, 200, {
            flowState: 'FAILED',
            copy: flowCopy('FAILED'),
            timeline,
            error: sheet.error || 'No amount rows found in spreadsheet',
          });
          return;
        }
        const previews = sheet.rows.map((row, idx) => ({
          id: `${idempotencyKey}_${idx}`,
          source,
          direction: row.entryType === 'in' ? 'MONEY_IN' : row.entryType === 'transfer' ? 'TRANSFER' : 'MONEY_OUT',
          amountPaise: Math.round(Number(row.amount || 0) * 100),
          description: row.description,
          merchant: row.merchant,
          category: row.category,
          paymentMethod: row.paymentMethod,
          date: row.date,
          receiptPath: receiptPath || undefined,
          receiptName: receiptName || undefined,
          processingStatus: 'READY',
          financialStatus: 'DRAFT',
          confidence: 'high',
          reasons: [],
          raw: text,
          entryType: row.entryType,
        }));
        apiJson(res, 200, {
          flowState: 'READY',
          copy: flowCopy('READY'),
          preview: previews[0],
          previews,
          timeline,
          autoConfirm: Boolean(body.autoConfirm),
        });
        return;
      }

      let vision: Awaited<ReturnType<typeof import('./receipt-vision.js').parseReceiptImage>> | null = null;
      const { parseReceiptImage } = await import('./receipt-vision.js');
      const { amountGroundedInText } = await import('./amount-parse.js');
      const shareLocalOnly = source === 'share' || source === 'sms' || Boolean(body.skipVision);
      // Mobile scan/share must stay OCR+rules. Gemini invents non-total numbers on noisy Play OCR.

      if (!shareLocalOnly && imageBase64 && imageBase64.length > 64 && imageBase64.length < 1.8 * 1024 * 1024) {
        try {
          vision = await parseReceiptImage({
            base64: imageBase64,
            mimeType: imageMime || 'image/jpeg',
            fileName: receiptName,
            hintText: docText,
            timeoutMs: 22_000,
          });
        } catch {
          vision = null;
        }
      }

      // Fallback: read stored receipt from R2 (email / web path only — never when shareLocalOnly).
      if (!shareLocalOnly && (!vision || vision.amount <= 0) && receiptPath) {
        try {
          const { r2FileKey, r2GetBytes } = await import('./r2.js');
          const key = r2FileKey(String(receiptPath));
          const file = await r2GetBytes(key);
          if (file?.body?.length) {
            const mimeGuess = (file.contentType || imageMime || 'image/jpeg').toLowerCase();
            const safeMime = mimeGuess.startsWith('image/') || mimeGuess === 'application/pdf'
              ? mimeGuess
              : (String(receiptName || '').toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
            if (safeMime === 'application/pdf' || /\.pdf$/i.test(receiptName)) {
              try {
                const { extractPdfText } = await import('./pdf-text.js');
                const pdfText = await extractPdfText(file.body);
                if (pdfText) docText = [docText, pdfText].filter(Boolean).join('\n').slice(0, 16_000);
              } catch {
                // Vision OCR below.
              }
            }
            vision = await parseReceiptImage({
              base64: file.body.toString('base64'),
              mimeType: safeMime,
              fileName: receiptName,
              hintText: docText,
              timeoutMs: 22_000,
            });
          } else if (!vision) {
            vision = {
              amount: 0,
              date: new Date().toISOString().slice(0, 10),
              merchant: '',
              description: receiptName || 'Shared receipt',
              category: 'Uncategorized',
              entryType: 'out',
              paymentMethod: 'cash',
              engine: 'r2_empty',
              notes: 'Stored receipt file was empty',
            };
          }
        } catch (err: any) {
          if (!vision) {
            vision = {
              amount: 0,
              date: new Date().toISOString().slice(0, 10),
              merchant: '',
              description: receiptName || 'Shared receipt',
              category: 'Uncategorized',
              entryType: 'out',
              paymentMethod: 'cash',
              engine: 'r2_error',
              notes: String(err?.message || 'Could not load stored receipt'),
            };
          }
        }
      }

      // Vision amounts must appear on the OCR text — never keep invented totals.
      if (vision && vision.amount > 0 && docText && !amountGroundedInText(docText, vision.amount)) {
        vision = { ...vision, amount: 0, notes: [vision.notes, 'ungrounded_amount'].filter(Boolean).join('; ') };
      }

      const textParsed = await parseAmountFromText(docText || '');
      const { enrichWithPpStructure, needsPpStructure, parsePpStructureText } = await import('./paddle-structure.js');

      // PP-Structure on share/OCR text (and optional remote PaddleOCR for complex docs).
      let structured: Awaited<ReturnType<typeof enrichWithPpStructure>> = null;
      try {
        const wantStructure = needsPpStructure({
          mimeType: imageMime,
          fileName: receiptName,
          text: docText,
          imageBase64Length: imageBase64?.length || 0,
        }) || !(vision && vision.amount > 0);
        if (wantStructure) {
          structured = await enrichWithPpStructure({
            text: docText,
            imageBase64: (!(vision && vision.amount > 0) ? imageBase64 : undefined),
            mimeType: imageMime,
            fileName: receiptName,
          });
        } else if (docText) {
          structured = parsePpStructureText(docText, receiptName);
        }
      } catch {
        structured = docText ? parsePpStructureText(docText, receiptName) : null;
      }

      // Prefer ₹-labeled OCR/text when Gemini invents masked UPI tails (e.g. 112 from XX112@oksbi).
      const amount = reconcileVisionAmount(
        vision?.amount || 0,
        docText || '',
        textParsed || (structured
          ? {
              amount: structured.amount,
              entryType: (structured.entryType as 'in' | 'out' | 'transfer') || 'out',
              description: structured.description || '',
              merchant: structured.merchant || '',
              paymentMethod: structured.paymentMethod || 'cash',
              date: structured.date || new Date().toISOString().slice(0, 10),
              confidence: structured.confidence || 'medium',
              score: structured.confidence === 'high' ? 50 : 28,
            }
          : null),
      ) || structured?.amount || textParsed?.amount || 0;
      const merchant = (
        (amount > 0 && vision && vision.amount === amount ? vision.merchant : '')
        || structured?.merchant
        || textParsed?.merchant
        || vision?.merchant
        || ''
      ).trim();
      const description = (
        (amount > 0 && vision && vision.amount === amount ? vision.description : '')
        || structured?.description
        || textParsed?.description
        || vision?.description
        || merchant
        || receiptName
        || 'Shared receipt'
      ).trim();
      const category = (
        (vision?.category && vision.category !== 'Uncategorized' && vision.amount === amount ? vision.category : '')
        || (structured?.category && structured.category !== 'Uncategorized' ? structured.category : '')
        || (textParsed as { category?: string } | null)?.category
        || vision?.category
        || 'Uncategorized'
      );
      const paymentMethod = (
        (amount > 0 && vision && vision.amount === amount ? vision.paymentMethod : '')
        || structured?.paymentMethod
        || vision?.paymentMethod
        || textParsed?.paymentMethod
        || 'cash'
      );
      const date = (vision?.date && /^\d{4}-\d{2}-\d{2}$/.test(vision.date) && vision.amount === amount ? vision.date : null)
        || structured?.date
        || textParsed?.date
        || new Date().toISOString().slice(0, 10);
      const entryType = (vision && vision.amount === amount ? vision.entryType : null)
        || structured?.entryType
        || textParsed?.entryType
        || 'out';

      push('receipt.classifying', 'CLASSIFYING');
      push('receipt.duplicate_check', 'DUPLICATE_CHECK');

      const reasons: string[] = [];

      const preview: Record<string, unknown> = {
        id: idempotencyKey,
        source,
        direction: entryType === 'in' ? 'MONEY_IN' : entryType === 'transfer' ? 'TRANSFER' : 'MONEY_OUT',
        amountPaise: Math.round(Number(amount || 0) * 100),
        description,
        merchant,
        category,
        paymentMethod,
        date,
        receiptPath: receiptPath || undefined,
        receiptName: receiptName || undefined,
        invoiceNumber: structured?.invoiceNumber || undefined,
        gstin: structured?.gstin || undefined,
        taxAmount: structured?.taxAmount || undefined,
        processingStatus: amount > 0 ? 'READY' : 'REVIEW_REQUIRED',
        financialStatus: 'DRAFT',
        confidence: amount > 0
          ? (structured?.confidence === 'high' || merchant ? 'high' : 'medium')
          : 'low',
        reasons,
        raw: docText || text,
        timeline,
      };

      const flowState = String(preview.processingStatus) === 'READY' && preview.confidence === 'high' ? 'READY' : 'REVIEW_REQUIRED';
      try {
        const sql = await getLedgerSql();
        await sql`
          INSERT INTO capture_events (id, book_id, uid, processing_status, financial_status, flow_state, data, created_at, updated_at)
          VALUES (
            ${idempotencyKey}, ${bookId}, ${user.uid},
            ${String(preview.processingStatus)}, ${String(preview.financialStatus)}, ${flowState},
            ${JSON.stringify(preview)}::jsonb, NOW(), NOW()
          )
          ON CONFLICT (id) DO UPDATE SET
            processing_status = EXCLUDED.processing_status,
            financial_status = EXCLUDED.financial_status,
            flow_state = EXCLUDED.flow_state,
            data = EXCLUDED.data,
            updated_at = NOW()
        `;
      } catch {
        // Capture event log is best-effort — never fail the parse response.
      }

      apiJson(res, 200, {
        flowState,
        copy: flowCopy(flowState),
        preview,
        timeline,
        autoConfirm: flowState === 'READY' && Boolean(body.autoConfirm),
      });
      return;
    }

    if (op === 'saveSplit') {
      const bookId = String(body.bookId || '').trim();
      const expenseId = String(body.expenseId || '').trim();
      const split = body.split && typeof body.split === 'object' ? body.split as Record<string, unknown> : null;
      if (!bookId || !expenseId || !split) throw new ApiError(400, 'Missing split payload');
      await ledgerRequireWriter(bookId, user.uid);
      await ensureMoneySchema();
      const sql = await getLedgerSql();
      const rows = await sql`SELECT data FROM expenses WHERE id = ${expenseId} AND book_id = ${bookId} LIMIT 1`;
      const row = Array.isArray(rows) ? rows[0] : null;
      if (!row) throw new ApiError(404, 'Expense not found');
      const expenseData = (row.data && typeof row.data === 'object' ? row.data : {}) as Record<string, unknown>;
      const book = await ledgerGetBookForUser(bookId, user.uid);
      const memberUids = book?.roles && typeof book.roles === 'object'
        ? Object.keys(book.roles as Record<string, unknown>)
        : [];
      const splitErr = validateSplitPayload({
        expenseAmount: Number(expenseData.amount || 0),
        split,
        memberUids,
      });
      if (splitErr) throw new ApiError(400, splitErr);
      const data = {
        ...expenseData,
        moneySplit: split,
        personSplits: Array.isArray(split.personSplits) ? split.personSplits : (expenseData.personSplits || []),
      };
      await sql`
        UPDATE expenses
        SET split_data = ${JSON.stringify(split)}::jsonb,
            data = ${JSON.stringify(data)}::jsonb,
            updated_at = NOW()
        WHERE id = ${expenseId} AND book_id = ${bookId}
      `;
      await ledgerAudit({
        bookId,
        actorUid: user.uid,
        actorEmail: user.email,
        action: 'expense.split_saved',
        entityType: 'expense',
        entityId: expenseId,
        detail: { method: split.method, participants: Array.isArray(split.participants) ? split.participants.length : 0 },
      });
      let settlements: unknown[] = [];
      try {
        settlements = await createSettlementsFromSplit({
          bookId,
          expenseId,
          split,
          expense: { ...expenseData, id: expenseId },
          actorUid: user.uid,
          actorEmail: user.email,
        });
      } catch (err) {
        console.error('settlement create failed', err);
      }
      apiJson(res, 200, { split, settlements, toast: '✓ Split updated' });
      return;
    }

    if (op === 'listSettlements') {
      const bookId = String(body.bookId || '').trim();
      if (!bookId) throw new ApiError(400, 'Missing ledger');
      const settlements = await listSettlementsForBook(bookId, user.uid);
      apiJson(res, 200, { settlements });
      return;
    }

    if (op === 'listMySettlements') {
      const settlements = await listMyOpenSettlements(user.uid);
      apiJson(res, 200, { settlements });
      return;
    }

    if (op === 'listMemberUpi') {
      const bookId = String(body.bookId || '').trim();
      if (!bookId) throw new ApiError(400, 'Missing ledger');
      const members = await getBookMemberUpiProfiles(bookId, user.uid);
      apiJson(res, 200, { members });
      return;
    }

    if (op === 'saveMyUpi') {
      const profile = await saveMyUpiProfile({
        uid: user.uid,
        email: user.email,
        upiId: String(body.upiId || ''),
        upiDisplayName: body.upiDisplayName ? String(body.upiDisplayName) : undefined,
        confirm: Boolean(body.confirm),
      });
      apiJson(res, 200, { profile });
      return;
    }

    if (op === 'requestMemberUpi') {
      const bookId = String(body.bookId || '').trim();
      const targetUid = String(body.targetUid || '').trim();
      if (!bookId || !targetUid) throw new ApiError(400, 'Missing member');
      const result = await requestMemberUpi({
        bookId,
        actorUid: user.uid,
        actorEmail: user.email,
        targetUid,
        reason: body.reason ? String(body.reason) : undefined,
      });
      apiJson(res, 200, result);
      return;
    }

    if (op === 'startUpiPayment') {
      const bookId = String(body.bookId || '').trim();
      const settlementId = String(body.settlementId || '').trim();
      if (!bookId || !settlementId) throw new ApiError(400, 'Missing settlement');
      const result = await startUpiPayment({
        bookId,
        settlementId,
        actorUid: user.uid,
        actorEmail: user.email,
        selectedApp: body.selectedApp ? String(body.selectedApp) : undefined,
      });
      apiJson(res, 200, result);
      return;
    }

    if (op === 'reportUpiReturn') {
      const bookId = String(body.bookId || '').trim();
      const attemptId = String(body.attemptId || '').trim();
      if (!bookId || !attemptId) throw new ApiError(400, 'Missing attempt');
      const result = await reportUpiReturn({
        bookId,
        attemptId,
        actorUid: user.uid,
        actorEmail: user.email,
        returnedStatus: body.returnedStatus ? String(body.returnedStatus) : undefined,
        responseCode: body.responseCode ? String(body.responseCode) : undefined,
        upiReference: body.upiReference ? String(body.upiReference) : undefined,
        raw: body.raw && typeof body.raw === 'object' ? body.raw as Record<string, unknown> : undefined,
        userAction: body.userAction as 'cancelled' | 'returned' | 'failed' | 'unknown' | 'success' | 'submitted' | undefined,
        outcome: body.outcome as 'success' | 'failed' | 'cancelled' | 'submitted' | 'unknown' | undefined,
      });
      apiJson(res, 200, result);
      return;
    }

    if (op === 'confirmSettlementReceived') {
      const bookId = String(body.bookId || '').trim();
      const settlementId = String(body.settlementId || '').trim();
      if (!bookId || !settlementId) throw new ApiError(400, 'Missing settlement');
      const result = await confirmSettlementReceived({
        bookId,
        settlementId,
        actorUid: user.uid,
        actorEmail: user.email,
        note: body.note ? String(body.note) : undefined,
      });
      apiJson(res, 200, result);
      return;
    }

    if (op === 'markSettlementReview') {
      const bookId = String(body.bookId || '').trim();
      const settlementId = String(body.settlementId || '').trim();
      if (!bookId || !settlementId) throw new ApiError(400, 'Missing settlement');
      const result = await markSettlementReview({
        bookId,
        settlementId,
        actorUid: user.uid,
        actorEmail: user.email,
        reason: body.reason ? String(body.reason) : undefined,
      });
      apiJson(res, 200, result);
      return;
    }

    if (op === 'listTimeline') {
      const bookId = String(body.bookId || '').trim();
      const expenseId = String(body.expenseId || '').trim();
      if (!bookId) throw new ApiError(400, 'Missing ledger');
      await ledgerRequireMember(bookId, user.uid);
      const events = await ledgerListAudit(user.uid, bookId, 120);
      const filtered = (events || [])
        .filter((ev: Record<string, unknown>) => !expenseId || String(ev.entityId || '') === expenseId || String((ev.detail as any)?.captureId || '') === expenseId)
        .map((ev: Record<string, unknown>) => ({
          id: String(ev.id || newId('ev')),
          at: String(ev.createdAt || ev.at || new Date().toISOString()),
          kind: String(ev.action || 'event'),
          title: String(ev.action || 'Activity').replace(/\./g, ' · '),
          detail: typeof ev.detail === 'object' ? JSON.stringify(ev.detail).slice(0, 160) : String(ev.detail || ''),
        }));
      apiJson(res, 200, { events: filtered.slice(0, 40) });
      return;
    }

    if (op === 'getRolePermissions' || op === 'setRolePermissions') {
      await ensureMoneySchema();
      const sql = await getLedgerSql();

      if (op === 'getRolePermissions') {
        const rows = await sql`SELECT role_key, features FROM role_permissions`;
        const map: Record<string, unknown> = {};
        for (const row of (Array.isArray(rows) ? rows : []) as Array<{ role_key: string; features: unknown }>) {
          map[row.role_key] = row.features || {};
        }
        apiJson(res, 200, { roles: map });
        return;
      }

      const profile = await ledgerGetUser(user.uid);
      const email = String(user.email || profile?.email || '').toLowerCase();
      const builtin = ['pujaribadrinath@gmail.com', 'byjanbooks@gmail.com'];
      const superEmails = String(process.env.SUPER_USER_EMAILS || process.env.VITE_SUPER_USER_EMAILS || builtin.join(','))
        .split(/[,;\s]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      const allowed = new Set([...builtin, ...superEmails]);
      if (!allowed.has(email)) throw new ApiError(403, 'Super user required');

      const roleKey = String(body.roleKey || '').trim();
      const features = body.features && typeof body.features === 'object' ? body.features : {};
      if (!roleKey) throw new ApiError(400, 'Missing role');
      await sql`
        INSERT INTO role_permissions (role_key, features, updated_at)
        VALUES (${roleKey}, ${JSON.stringify(features)}::jsonb, NOW())
        ON CONFLICT (role_key) DO UPDATE SET features = EXCLUDED.features, updated_at = NOW()
      `;
      apiJson(res, 200, { ok: true, roleKey, features });
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

    throw new ApiError(400, `Unknown money operation${op ? `: ${op}` : ''}`);
  });
}

export async function checkExpenseIdempotency(bookId: string, uid: string, key: string) {
  return getIdempotent(key, bookId, uid);
}

export async function storeExpenseIdempotency(bookId: string, uid: string, key: string, response: Record<string, unknown>) {
  return putIdempotent(key, bookId, uid, response);
}

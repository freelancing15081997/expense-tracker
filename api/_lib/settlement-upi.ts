/**
 * Settlement + UPI payment-attempt persistence.
 * PAID only from explicit UPI intent SUCCESS (or optional receiver confirm).
 * Launching a UPI app alone is never success.
 */

import { randomBytes } from 'node:crypto';
import {
  ApiError,
  ledgerAddNotification,
  ledgerAudit,
  ledgerGetBookForUser,
  ledgerGetUser,
  ledgerRequireMember,
  ledgerUpsertUser,
  getLedgerSql,
} from '../_pg-tables.js';

const UPI_VPA_RE = /^[a-zA-Z0-9.\-_]{1,256}@[a-zA-Z]{2,64}$/;

function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
}

function normalizeVpa(raw: unknown) {
  return String(raw || '').trim().toLowerCase().replace(/\s+/g, '');
}

function isValidVpa(raw: unknown) {
  const vpa = normalizeVpa(raw);
  if (!vpa || /^\d{10}$/.test(String(raw || '').trim())) return false;
  return UPI_VPA_RE.test(vpa);
}

function paiseToUpiAmount(paise: number) {
  return (Math.max(0, Math.round(paise || 0)) / 100).toFixed(2);
}

function buildUpiPayUri(opts: { pa: string; pn: string; am: string; tn?: string; tr?: string }) {
  const q = new URLSearchParams();
  q.set('pa', opts.pa);
  q.set('pn', opts.pn.slice(0, 80));
  q.set('am', opts.am);
  q.set('cu', 'INR');
  if (opts.tn) q.set('tn', opts.tn.slice(0, 80));
  if (opts.tr) q.set('tr', opts.tr.slice(0, 35));
  return `upi://pay?${q.toString()}`;
}

function asRows<T>(rows: unknown): T[] {
  return Array.isArray(rows) ? (rows as T[]) : [];
}

export async function ensureSettlementSchema() {
  const sql = await getLedgerSql();
  await sql`CREATE TABLE IF NOT EXISTS money_settlements (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    expense_id TEXT,
    split_id TEXT,
    from_uid TEXT NOT NULL,
    to_uid TEXT NOT NULL,
    amount NUMERIC(18,2) NOT NULL,
    amount_paise BIGINT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'UNPAID',
    note TEXT,
    merchant TEXT,
    expense_description TEXT,
    receiver_upi_snapshot TEXT,
    receiver_name_snapshot TEXT,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS money_settlements_book_idx ON money_settlements (book_id, status, updated_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS money_settlements_from_idx ON money_settlements (from_uid, status)`;
  await sql`CREATE INDEX IF NOT EXISTS money_settlements_to_idx ON money_settlements (to_uid, status)`;
  await sql`CREATE INDEX IF NOT EXISTS money_settlements_expense_idx ON money_settlements (expense_id)`;

  await sql`CREATE TABLE IF NOT EXISTS money_payment_attempts (
    id TEXT PRIMARY KEY,
    settlement_id TEXT NOT NULL REFERENCES money_settlements(id),
    book_id TEXT NOT NULL,
    payer_uid TEXT NOT NULL,
    receiver_uid TEXT NOT NULL,
    amount NUMERIC(18,2) NOT NULL,
    amount_paise BIGINT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    upi_id TEXT NOT NULL,
    recipient_name TEXT,
    selected_payment_app TEXT,
    generated_txn_id TEXT NOT NULL,
    upi_uri TEXT,
    response_code TEXT,
    returned_status TEXT,
    upi_reference TEXT,
    verification_source TEXT,
    failure_reason TEXT,
    raw_return JSONB,
    initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    returned_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS money_payment_attempts_settlement_idx ON money_payment_attempts (settlement_id, initiated_at DESC)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS money_payment_attempts_txn_uidx ON money_payment_attempts (generated_txn_id)`;
}

function mapSettlement(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    bookId: String(row.book_id),
    expenseId: row.expense_id ? String(row.expense_id) : undefined,
    splitId: row.split_id ? String(row.split_id) : undefined,
    fromUid: String(row.from_uid),
    toUid: String(row.to_uid),
    amountPaise: Number(row.amount_paise || 0),
    amount: Number(row.amount || 0),
    currency: String(row.currency || 'INR'),
    status: String(row.status || 'UNPAID'),
    note: row.note ? String(row.note) : '',
    merchant: row.merchant ? String(row.merchant) : '',
    expenseDescription: row.expense_description ? String(row.expense_description) : '',
    receiverUpiSnapshot: row.receiver_upi_snapshot ? String(row.receiver_upi_snapshot) : '',
    receiverNameSnapshot: row.receiver_name_snapshot ? String(row.receiver_name_snapshot) : '',
    createdAt: row.created_at ? String(row.created_at) : undefined,
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
    data: (row.data && typeof row.data === 'object' ? row.data : {}) as Record<string, unknown>,
  };
}

async function notifySafe(input: {
  userId: string;
  bookId: string;
  bookName?: string;
  action: string;
  detail: string;
  link?: string;
}) {
  try {
    await ledgerAddNotification({
      id: newId('ntf'),
      userId: input.userId,
      bookId: input.bookId,
      bookName: input.bookName || '',
      kind: 'settlement',
      action: input.action,
      detail: input.detail,
      link: input.link || `/book/${input.bookId}?settlements=1`,
      read: false,
      createdAt: new Date().toISOString(),
    });
  } catch {
    /* notifications must never roll back money */
  }
}

export async function createSettlementsFromSplit(opts: {
  bookId: string;
  expenseId: string;
  split: Record<string, unknown>;
  expense: Record<string, unknown>;
  actorUid: string;
  actorEmail: string;
}) {
  await ensureSettlementSchema();
  const sql = await getLedgerSql();
  const book = await ledgerGetBookForUser(opts.bookId, opts.actorUid);
  const bookName = String(book?.name || 'Money book');
  const payerUid = String(opts.expense.enteredByUid || opts.actorUid);
  const splitId = String(opts.split.id || newId('split'));
  const participants = Array.isArray(opts.split.participants) ? opts.split.participants as Array<Record<string, unknown>> : [];
  const allocations = Array.isArray(opts.split.allocations) ? opts.split.allocations as Array<Record<string, unknown>> : [];
  const merchant = String(opts.expense.merchant || '');
  const description = String(opts.expense.description || 'Expense');

  // Cancel prior unpaid obligations for this expense (split re-save).
  await sql`
    UPDATE money_settlements
    SET status = 'CANCELLED', updated_at = NOW(),
        data = COALESCE(data, '{}'::jsonb) || ${JSON.stringify({ cancelledReason: 'split_replaced' })}::jsonb
    WHERE expense_id = ${opts.expenseId}
      AND book_id = ${opts.bookId}
      AND status IN ('UNPAID', 'REQUESTED', 'NOTIFIED', 'PENDING', 'FAILED', 'UNKNOWN', 'REVIEW_REQUIRED', 'CANCELLED')
  `;

  const created: ReturnType<typeof mapSettlement>[] = [];
  for (let i = 0; i < participants.length; i += 1) {
    const p = participants[i];
    const uid = String(p.uid || allocations[i]?.participantKey || '').trim();
    if (!uid || uid === payerUid) continue;
    const amountPaise = Math.round(Number(allocations[i]?.amountPaise ?? p.amountPaise ?? 0));
    if (amountPaise <= 0) continue;

    const receiver = await ledgerGetUser(payerUid);
    const receiverUpi = normalizeVpa(receiver?.upiId);
    const receiverName = String(receiver?.upiDisplayName || receiver?.displayName || receiver?.email || 'Member');
    const id = newId('setl');
    const amount = Number(paiseToUpiAmount(amountPaise));
    const note = `${String(p.name || p.email || 'Member')} owes share`;
    await sql`
      INSERT INTO money_settlements (
        id, book_id, expense_id, split_id, from_uid, to_uid,
        amount, amount_paise, currency, status, note, merchant, expense_description,
        receiver_upi_snapshot, receiver_name_snapshot, data, created_at, updated_at
      ) VALUES (
        ${id}, ${opts.bookId}, ${opts.expenseId}, ${splitId}, ${uid}, ${payerUid},
        ${amount}, ${amountPaise}, ${String(opts.expense.currency || book?.currency || 'INR')},
        'UNPAID', ${note}, ${merchant}, ${description},
        ${receiverUpi || null}, ${receiverName},
        ${JSON.stringify({ splitMethod: opts.split.method, participantEmail: p.email || '' })}::jsonb,
        NOW(), NOW()
      )
    `;
    const row = mapSettlement({
      id,
      book_id: opts.bookId,
      expense_id: opts.expenseId,
      split_id: splitId,
      from_uid: uid,
      to_uid: payerUid,
      amount,
      amount_paise: amountPaise,
      currency: opts.expense.currency || book?.currency || 'INR',
      status: 'UNPAID',
      note,
      merchant,
      expense_description: description,
      receiver_upi_snapshot: receiverUpi,
      receiver_name_snapshot: receiverName,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      data: {},
    });
    created.push(row);
    const amtLabel = `₹${paiseToUpiAmount(amountPaise)}`;
    await notifySafe({
      userId: uid,
      bookId: opts.bookId,
      bookName,
      action: 'Split share due',
      detail: `Pay ${amtLabel} for “${description}” in ${bookName}`,
    });
  }

  await ledgerAudit({
    bookId: opts.bookId,
    actorUid: opts.actorUid,
    actorEmail: opts.actorEmail,
    action: 'settlement.split_created',
    entityType: 'expense',
    entityId: opts.expenseId,
    detail: { count: created.length, splitId, payerUid },
  });

  // Nudge payer if they have no UPI — receivers need it to pay them.
  if (created.length && !isValidVpa((await ledgerGetUser(payerUid))?.upiId)) {
    await notifySafe({
      userId: payerUid,
      bookId: opts.bookId,
      bookName,
      action: 'Add your UPI ID',
      detail: 'Teammates need your verified UPI ID to settle this split.',
      link: `/settings?upi=1`,
    });
  }

  return created;
}

export async function listSettlementsForBook(bookId: string, uid: string) {
  await ledgerRequireMember(bookId, uid);
  await ensureSettlementSchema();
  const sql = await getLedgerSql();
  const rows = asRows<Record<string, unknown>>(await sql`
    SELECT * FROM money_settlements
    WHERE book_id = ${bookId}
    ORDER BY updated_at DESC
    LIMIT 200
  `);
  return rows.map(mapSettlement);
}

export async function getBookMemberUpiProfiles(bookId: string, actorUid: string) {
  await ledgerRequireMember(bookId, actorUid);
  const book = await ledgerGetBookForUser(bookId, actorUid);
  const roles = book?.roles && typeof book.roles === 'object' ? book.roles as Record<string, { email?: string }> : {};
  const uids = Object.keys(roles);
  if (book?.ownerId && !uids.includes(String(book.ownerId))) uids.push(String(book.ownerId));
  const out: Array<{
    uid: string;
    email: string;
    displayName: string;
    upiId: string;
    upiDisplayName: string;
    upiStatus: string;
    hasUpi: boolean;
  }> = [];
  for (const uid of uids) {
    const profile = await ledgerGetUser(uid);
    const email = String(profile?.email || roles[uid]?.email || '');
    const upiId = normalizeVpa(profile?.upiId);
    const upiStatus = String(profile?.upiStatus || (upiId ? 'FORMAT_OK' : 'UNSET'));
    out.push({
      uid,
      email,
      displayName: String(profile?.displayName || email.split('@')[0] || 'Member'),
      // Only expose UPI when self-confirmed or format-ok — needed for pay.
      upiId: upiStatus === 'SELF_CONFIRMED' || upiStatus === 'FORMAT_OK' ? upiId : '',
      upiDisplayName: String(profile?.upiDisplayName || profile?.displayName || ''),
      upiStatus,
      hasUpi: Boolean(upiId) && (upiStatus === 'SELF_CONFIRMED' || upiStatus === 'FORMAT_OK'),
    });
  }
  return out;
}

export async function saveMyUpiProfile(opts: {
  uid: string;
  email: string;
  upiId: string;
  upiDisplayName?: string;
  confirm: boolean;
}) {
  const vpa = normalizeVpa(opts.upiId);
  if (!isValidVpa(vpa)) {
    throw new ApiError(400, 'Enter a valid UPI ID like name@oksbi — not a phone number alone.');
  }
  if (!opts.confirm) {
    throw new ApiError(400, 'Confirm that this UPI ID belongs to you.');
  }
  const now = new Date().toISOString();
  const saved = await ledgerUpsertUser(opts.uid, {
    uid: opts.uid,
    email: opts.email,
    upiId: vpa,
    upiDisplayName: String(opts.upiDisplayName || '').trim() || undefined,
    upiStatus: 'SELF_CONFIRMED',
    upiConfirmedAt: now,
    updatedAt: now,
  }, true);
  await ledgerAudit({
    actorUid: opts.uid,
    actorEmail: opts.email,
    action: 'user.upi_confirmed',
    entityType: 'user',
    entityId: opts.uid,
    detail: { upiId: vpa },
  });
  return {
    upiId: vpa,
    upiDisplayName: String(saved.upiDisplayName || opts.upiDisplayName || ''),
    upiStatus: 'SELF_CONFIRMED',
    upiConfirmedAt: now,
  };
}

export async function requestMemberUpi(opts: {
  bookId: string;
  actorUid: string;
  actorEmail: string;
  targetUid: string;
  reason?: string;
}) {
  await ledgerRequireMember(opts.bookId, opts.actorUid);
  const book = await ledgerGetBookForUser(opts.bookId, opts.actorUid);
  const roles = book?.roles && typeof book.roles === 'object' ? book.roles as Record<string, unknown> : {};
  if (!roles[opts.targetUid] && String(book?.ownerId) !== opts.targetUid) {
    throw new ApiError(404, 'Member not found on this book');
  }
  await notifySafe({
    userId: opts.targetUid,
    bookId: opts.bookId,
    bookName: String(book?.name || ''),
    action: 'UPI ID needed for splits',
    detail: opts.reason || `${opts.actorEmail} needs your UPI ID to settle shares in ${book?.name || 'this book'}.`,
    link: `/settings?upi=1`,
  });
  await ledgerAudit({
    bookId: opts.bookId,
    actorUid: opts.actorUid,
    actorEmail: opts.actorEmail,
    action: 'settlement.upi_requested',
    entityType: 'user',
    entityId: opts.targetUid,
  });
  return { ok: true };
}

export async function startUpiPayment(opts: {
  bookId: string;
  settlementId: string;
  actorUid: string;
  actorEmail: string;
  selectedApp?: string;
}) {
  await ledgerRequireMember(opts.bookId, opts.actorUid);
  await ensureSettlementSchema();
  const sql = await getLedgerSql();
  const rows = asRows<Record<string, unknown>>(await sql`
    SELECT * FROM money_settlements WHERE id = ${opts.settlementId} AND book_id = ${opts.bookId} LIMIT 1
  `);
  const row = rows[0];
  if (!row) throw new ApiError(404, 'Settlement not found');
  const settlement = mapSettlement(row);
  if (settlement.fromUid !== opts.actorUid) {
    throw new ApiError(403, 'Only the member who owes this share can start payment');
  }
  if (settlement.status === 'PAID') {
    throw new ApiError(409, 'This settlement is already marked paid');
  }
  if (!['UNPAID', 'FAILED', 'CANCELLED', 'EXPIRED', 'UNKNOWN', 'REVIEW_REQUIRED', 'PENDING', 'REQUESTED', 'NOTIFIED', 'AWAITING_CONFIRMATION', 'PAYMENT_STARTED'].includes(settlement.status)) {
    throw new ApiError(409, `Cannot start payment from status ${settlement.status}`);
  }

  // Live receiver UPI from profile (historical snapshot not mutated for old paid rows).
  const receiver = await ledgerGetUser(settlement.toUid);
  const upiId = normalizeVpa(receiver?.upiId);
  const upiStatus = String(receiver?.upiStatus || '');
  if (!isValidVpa(upiId) || (upiStatus !== 'SELF_CONFIRMED' && upiStatus !== 'FORMAT_OK')) {
    throw new ApiError(409, 'Recipient has not added a confirmed UPI ID yet. Ask them to add it in Settings.', {
      code: 'RECEIVER_UPI_MISSING',
      toUid: settlement.toUid,
    });
  }
  const recipientName = String(receiver?.upiDisplayName || receiver?.displayName || receiver?.email || 'Member');
  const amountPaise = Number(settlement.amountPaise);
  if (!(amountPaise > 0)) throw new ApiError(400, 'Invalid settlement amount');

  const txnId = newId('txn').replace(/[^a-zA-Z0-9]/g, '').slice(0, 35);
  const am = paiseToUpiAmount(amountPaise);
  const tn = `Byjan ${settlement.expenseDescription || 'split'}`.slice(0, 80);
  let upiUri = '';
  let prefillOk = true;
  try {
    upiUri = buildUpiPayUri({ pa: upiId, pn: recipientName, am, tn, tr: txnId });
  } catch {
    prefillOk = false;
  }

  const attemptId = newId('pay');
  const selectedApp = String(opts.selectedApp || 'generic').slice(0, 40);
  await sql`
    INSERT INTO money_payment_attempts (
      id, settlement_id, book_id, payer_uid, receiver_uid,
      amount, amount_paise, currency, upi_id, recipient_name,
      selected_payment_app, generated_txn_id, upi_uri, data, initiated_at, created_at, updated_at
    ) VALUES (
      ${attemptId}, ${settlement.id}, ${opts.bookId}, ${opts.actorUid}, ${settlement.toUid},
      ${Number(am)}, ${amountPaise}, ${settlement.currency}, ${upiId}, ${recipientName},
      ${selectedApp}, ${txnId}, ${upiUri || null},
      ${JSON.stringify({ prefillOk })}::jsonb,
      NOW(), NOW(), NOW()
    )
  `;

  await sql`
    UPDATE money_settlements
    SET status = 'PAYMENT_STARTED',
        receiver_upi_snapshot = ${upiId},
        receiver_name_snapshot = ${recipientName},
        updated_at = NOW()
    WHERE id = ${settlement.id}
  `;

  await ledgerAudit({
    bookId: opts.bookId,
    actorUid: opts.actorUid,
    actorEmail: opts.actorEmail,
    action: 'settlement.payment_started',
    entityType: 'settlement',
    entityId: settlement.id,
    detail: { attemptId, selectedApp, amountPaise, txnId },
  });

  await notifySafe({
    userId: settlement.toUid,
    bookId: opts.bookId,
    action: 'Payment started',
    detail: `Someone started a ₹${am} UPI payment for your share.`,
  });

  return {
    attemptId,
    settlementId: settlement.id,
    status: 'PAYMENT_STARTED',
    amountPaise,
    amount: am,
    currency: settlement.currency,
    upiId,
    recipientName,
    generatedTxnId: txnId,
    upiUri,
    prefillOk,
    message: 'Complete payment in your UPI app — success or failure is read automatically when the app returns it.',
    fallback: prefillOk ? null : {
      title: 'UPI payment could not be fully prefilled',
      upiId,
      amount: am,
      note: tn,
    },
  };
}

/** Apply UPI app return. Marks PAID only when the app returns an explicit success status/code. */
export async function reportUpiReturn(opts: {
  bookId: string;
  attemptId: string;
  actorUid: string;
  actorEmail: string;
  returnedStatus?: string;
  responseCode?: string;
  upiReference?: string;
  raw?: Record<string, unknown>;
  userAction?: 'cancelled' | 'returned' | 'failed' | 'unknown' | 'success' | 'submitted';
  outcome?: 'success' | 'failed' | 'cancelled' | 'submitted' | 'unknown';
}) {
  await ledgerRequireMember(opts.bookId, opts.actorUid);
  await ensureSettlementSchema();
  const sql = await getLedgerSql();
  const attempts = asRows<Record<string, unknown>>(await sql`
    SELECT * FROM money_payment_attempts WHERE id = ${opts.attemptId} AND book_id = ${opts.bookId} LIMIT 1
  `);
  const attempt = attempts[0];
  if (!attempt) throw new ApiError(404, 'Payment attempt not found');
  if (String(attempt.payer_uid) !== opts.actorUid) throw new ApiError(403, 'Not your payment attempt');

  if (attempt.verified_at) {
    return { status: 'PAID', attemptId: opts.attemptId, settlementId: String(attempt.settlement_id), idempotent: true };
  }
  const settleRows = asRows<Record<string, unknown>>(await sql`
    SELECT status FROM money_settlements WHERE id = ${String(attempt.settlement_id)} LIMIT 1
  `);
  if (String(settleRows[0]?.status || '') === 'PAID') {
    return { status: 'PAID', attemptId: opts.attemptId, settlementId: String(attempt.settlement_id), idempotent: true };
  }

  const statusRaw = String(opts.returnedStatus || '').trim();
  const codeRaw = String(opts.responseCode || '').trim();
  const outcome = String(opts.outcome || opts.userAction || '').toLowerCase();
  const statusUp = statusRaw.toUpperCase();
  const codeUp = codeRaw.toUpperCase();

  const explicitSuccess =
    outcome === 'success'
    || statusUp.includes('SUCCESS')
    || codeUp === '00'
    || codeUp === '0';
  const explicitFail =
    outcome === 'failed'
    || statusUp.includes('FAIL')
    || codeUp === '01';
  const explicitCancel =
    outcome === 'cancelled'
    || statusUp.includes('CANCEL');
  const submitted =
    outcome === 'submitted'
    || statusUp.includes('SUBMIT');

  let next = 'UNKNOWN';
  let failure = '';
  let verificationSource: string | null = null;
  let markPaid = false;

  // Treat payment cancel like a failed attempt so the settlement stays retryable.
  if (explicitSuccess) {
    next = 'PAID';
    markPaid = true;
    verificationSource = 'upi_intent_result';
  } else if (explicitFail || explicitCancel) {
    next = 'FAILED';
    failure = explicitCancel ? 'Payment cancelled in UPI app' : 'UPI app reported failure';
  } else if (submitted) {
    next = 'AWAITING_CONFIRMATION';
  } else if (outcome === 'returned' || outcome === 'unknown') {
    next = 'UNKNOWN';
    failure = 'UPI app did not return a clear success or failure';
  } else {
    next = 'UNKNOWN';
    failure = 'No reliable UPI result from the app';
  }

  const raw = { ...(opts.raw || {}) };
  delete (raw as any).pin;
  delete (raw as any).upiPin;
  delete (raw as any).password;

  if (markPaid) {
    await sql`
      UPDATE money_payment_attempts
      SET returned_status = ${String(statusRaw || outcome || 'SUCCESS').slice(0, 80)},
          response_code = ${codeRaw ? codeRaw.slice(0, 40) : null},
          upi_reference = ${opts.upiReference ? String(opts.upiReference).slice(0, 80) : null},
          failure_reason = NULL,
          verification_source = ${verificationSource},
          verified_at = NOW(),
          raw_return = ${JSON.stringify(raw)}::jsonb,
          returned_at = NOW(),
          updated_at = NOW()
      WHERE id = ${opts.attemptId}
    `;
    await sql`
      UPDATE money_settlements
      SET status = 'PAID', updated_at = NOW(),
          data = COALESCE(data, '{}'::jsonb) || ${JSON.stringify({
            verificationSource: 'upi_intent_result',
            confirmedAt: new Date().toISOString(),
          })}::jsonb
      WHERE id = ${String(attempt.settlement_id)}
        AND status <> 'PAID'
    `;
  } else {
    await sql`
      UPDATE money_payment_attempts
      SET returned_status = ${String(statusRaw || outcome || 'unknown').slice(0, 80)},
          response_code = ${codeRaw ? codeRaw.slice(0, 40) : null},
          upi_reference = ${opts.upiReference ? String(opts.upiReference).slice(0, 80) : null},
          failure_reason = ${failure || null},
          raw_return = ${JSON.stringify(raw)}::jsonb,
          returned_at = NOW(),
          updated_at = NOW()
      WHERE id = ${opts.attemptId}
    `;
    await sql`
      UPDATE money_settlements
      SET status = ${next}, updated_at = NOW()
      WHERE id = ${String(attempt.settlement_id)}
        AND status <> 'PAID'
    `;
  }

  await ledgerAudit({
    bookId: opts.bookId,
    actorUid: opts.actorUid,
    actorEmail: opts.actorEmail,
    action: markPaid ? 'settlement.paid_upi_result' : 'settlement.payment_return',
    entityType: 'payment_attempt',
    entityId: opts.attemptId,
    detail: { next, responseCode: codeRaw || null, status: statusRaw || null, outcome },
  });

  if (markPaid) {
    await notifySafe({
      userId: String(attempt.receiver_uid),
      bookId: opts.bookId,
      action: 'Settlement paid',
      detail: `UPI payment of ₹${paiseToUpiAmount(Number(attempt.amount_paise || 0))} completed.`,
    });
  }

  const message =
    next === 'PAID' ? 'Payment successful — marked paid from the UPI app result.'
      : next === 'FAILED' ? (explicitCancel ? 'Payment cancelled. Retry when ready.' : 'Payment failed in the UPI app. Retry when ready.')
        : next === 'AWAITING_CONFIRMATION' ? 'UPI app submitted the payment. Recipient can confirm later if needed.'
          : 'We couldn’t read a clear result from the UPI app. You can retry, or the recipient can confirm later.';

  return {
    status: next,
    attemptId: opts.attemptId,
    settlementId: String(attempt.settlement_id),
    message,
  };
}

/** Only the receiver can confirm funds received → PAID. */
export async function confirmSettlementReceived(opts: {
  bookId: string;
  settlementId: string;
  actorUid: string;
  actorEmail: string;
  note?: string;
}) {
  await ledgerRequireMember(opts.bookId, opts.actorUid);
  await ensureSettlementSchema();
  const sql = await getLedgerSql();
  const rows = asRows<Record<string, unknown>>(await sql`
    SELECT * FROM money_settlements WHERE id = ${opts.settlementId} AND book_id = ${opts.bookId} LIMIT 1
  `);
  const row = rows[0];
  if (!row) throw new ApiError(404, 'Settlement not found');
  const settlement = mapSettlement(row);
  if (settlement.toUid !== opts.actorUid) {
    throw new ApiError(403, 'Only the recipient can confirm this payment was received');
  }
  if (settlement.status === 'PAID') {
    return { status: 'PAID', settlementId: settlement.id, idempotent: true };
  }

  await sql`
    UPDATE money_settlements
    SET status = 'PAID', updated_at = NOW(),
        data = COALESCE(data, '{}'::jsonb) || ${JSON.stringify({
          confirmedBy: opts.actorUid,
          confirmedAt: new Date().toISOString(),
          note: opts.note || '',
          verificationSource: 'receiver_confirm',
        })}::jsonb
    WHERE id = ${settlement.id}
  `;

  await sql`
    UPDATE money_payment_attempts
    SET verified_at = NOW(),
        verification_source = 'receiver_confirm',
        updated_at = NOW()
    WHERE settlement_id = ${settlement.id}
      AND verified_at IS NULL
  `;

  await ledgerAudit({
    bookId: opts.bookId,
    actorUid: opts.actorUid,
    actorEmail: opts.actorEmail,
    action: 'settlement.paid_confirmed',
    entityType: 'settlement',
    entityId: settlement.id,
    detail: { verificationSource: 'receiver_confirm' },
  });

  await notifySafe({
    userId: settlement.fromUid,
    bookId: opts.bookId,
    action: 'Settlement paid',
    detail: `Your ₹${paiseToUpiAmount(settlement.amountPaise)} payment was confirmed.`,
  });

  return { status: 'PAID', settlementId: settlement.id };
}

export async function markSettlementReview(opts: {
  bookId: string;
  settlementId: string;
  actorUid: string;
  actorEmail: string;
  reason?: string;
}) {
  await ledgerRequireMember(opts.bookId, opts.actorUid);
  await ensureSettlementSchema();
  const sql = await getLedgerSql();
  const rows = asRows<Record<string, unknown>>(await sql`
    SELECT * FROM money_settlements WHERE id = ${opts.settlementId} AND book_id = ${opts.bookId} LIMIT 1
  `);
  const row = rows[0];
  if (!row) throw new ApiError(404, 'Settlement not found');
  const settlement = mapSettlement(row);
  if (settlement.fromUid !== opts.actorUid && settlement.toUid !== opts.actorUid) {
    throw new ApiError(403, 'Not a party to this settlement');
  }
  if (settlement.status === 'PAID') throw new ApiError(409, 'Already paid');

  await sql`
    UPDATE money_settlements
    SET status = 'REVIEW_REQUIRED', updated_at = NOW(),
        data = COALESCE(data, '{}'::jsonb) || ${JSON.stringify({ reviewReason: opts.reason || 'manual', by: opts.actorUid })}::jsonb
    WHERE id = ${settlement.id}
  `;
  await ledgerAudit({
    bookId: opts.bookId,
    actorUid: opts.actorUid,
    actorEmail: opts.actorEmail,
    action: 'settlement.review_required',
    entityType: 'settlement',
    entityId: settlement.id,
    detail: { reason: opts.reason || '' },
  });
  return { status: 'REVIEW_REQUIRED', settlementId: settlement.id };
}

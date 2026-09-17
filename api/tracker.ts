import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  ApiError,
  apiJson,
  ledgerAddEmailEvent,
  ledgerAddNotification,
  ledgerAudit,
  ledgerCreateBook,
  ledgerEnsureMailbox,
  ledgerGet,
  ledgerGetBookForUser,
  ledgerGetExpense,
  ledgerGetUser,
  ledgerListBooksForUser,
  ledgerListExpensesByBooks,
  ledgerListLiveExpenses,
  ledgerListMailEvents,
  ledgerListNotifications,
  ledgerMarkNotificationRead,
  ledgerMarkAllNotificationsRead,
  ledgerMember,
  ledgerRemoveMember,
  ledgerRequireManager,
  ledgerRequireMember,
  ledgerRequireWriter,
  ledgerSaveExpense,
  ledgerSet,
  ledgerSoftDeleteBook,
  ledgerSoftDeleteExpense,
  ledgerUpdateBook,
  ledgerUpsertUser,
  ledgerFindDuplicateExpense,
  ledgerListAudit,
  assertErpWorkspace,
  erpLoadWorkspace,
  ledgerDel,
  ledgerList,
  getLedgerSql,
  withDomainApi,
} from './_pg-tables.js';

function parseSuperEmails(raw: string) {
  return String(raw || '')
    .split(/[,;\s]+/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function emailIsSuperUser(email?: string | null) {
  const needle = String(email || '').trim().toLowerCase();
  if (!needle) return false;
  const builtin = ['pujaribadrinath@gmail.com', 'byjanbooks@gmail.com'];
  const extra = parseSuperEmails(String(process.env.SUPER_USER_EMAILS || process.env.VITE_SUPER_USER_EMAILS || ''));
  return [...new Set([...builtin, ...extra])].includes(needle);
}

type Domain = 'ledgers' | 'expenses' | 'notifications' | 'me' | 'books' | 'money';

async function moneyModule() {
  try {
    return await import('./_lib/money-handlers.js');
  } catch (err) {
    throw new ApiError(500, err instanceof Error ? err.message : 'Money module unavailable');
  }
}

async function pushModule() {
  try {
    return await import('./_lib/fcm.js');
  } catch {
    return { sendFcm: async () => ({ ok: false }) };
  }
}

async function notifyBookMembersPush(
  bookId: string,
  actorUid: string,
  payload: { title: string; body: string; action?: string },
) {
  let book: Record<string, unknown>;
  try {
    book = await ledgerGetBookForUser(bookId, actorUid) as Record<string, unknown>;
  } catch {
    return;
  }
  const roles = book.roles && typeof book.roles === 'object' && !Array.isArray(book.roles)
    ? book.roles as Record<string, unknown>
    : {};
  const uids = new Set(Object.keys(roles).filter(Boolean));
  const ownerId = String(book.ownerId || '');
  if (ownerId) uids.add(ownerId);
  uids.delete(String(actorUid || ''));
  if (!uids.size) return;
  const { sendFcm } = await pushModule();
  const bookName = String(book.name || payload.title || 'Byjan');
  await Promise.all([...uids].map(async (uid) => {
    const profile = await ledgerGetUser(uid);
    const token = String(profile?.pushToken || '').trim();
    if (!token) {
      console.error('FCM skip: no push token', uid);
      return;
    }
    await sendFcm(token, {
      title: bookName,
      body: payload.body,
      data: { bookId, url: `/#/book/${bookId}`, kind: 'entry', action: payload.action || 'entry' },
    });
  }));
}

function domainFrom(req: VercelRequest): Domain | '' {
  const raw = req.query?.domain;
  const query = Array.isArray(raw) ? raw[0] : raw;
  const hinted = String(query || '').trim();
  if (hinted === 'ledgers' || hinted === 'expenses' || hinted === 'notifications' || hinted === 'me' || hinted === 'books' || hinted === 'money') return hinted;
  try {
    const path = new URL(req.url || '/', 'https://local.invalid').pathname;
    const part = path.split('/').filter(Boolean)[1] || '';
    if (part === 'ledgers' || part === 'expenses' || part === 'notifications' || part === 'me' || part === 'books' || part === 'money') return part;
  } catch {
    // fall through
  }
  return '';
}

function uniqueCategories(current: unknown, name: string) {
  const next: string[] = [];
  const seen = new Set<string>();
  for (const raw of [...(Array.isArray(current) ? current : []), name]) {
    const value = String(raw || '').trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(value);
  }
  return next;
}

async function mergeCategory(bookId: string, category: string) {
  const name = String(category || '').trim();
  if (!name || name === 'Uncategorized') return;
  const book = await ledgerGet(`books/${bookId}`);
  if (!book) return;
  const existing = Array.isArray(book.categories) ? book.categories.map(String) : [];
  if (existing.some((row) => row.toLowerCase() === name.toLowerCase())) return;
  await ledgerSet(`books/${bookId}`, { ...book, categories: uniqueCategories(existing, name) });
}

async function handleLedgers(req: VercelRequest, res: VercelResponse) {
  await withDomainApi(req, res, async (user, body) => {
    const op = String(body.op || '');

    if (op === 'list') {
      apiJson(res, 200, { books: await ledgerListBooksForUser(user.uid) });
      return;
    }

    if (op === 'get') {
      const bookId = String(body.bookId || '').trim();
      if (!bookId) throw new ApiError(400, 'Missing ledger');
      const book = await ledgerGetBookForUser(bookId, user.uid);
      apiJson(res, 200, { book });
      return;
    }

    if (op === 'create') {
      const categories = Array.isArray(body.categories)
        ? body.categories.map((c: unknown) => String(c || '').trim()).filter(Boolean)
        : undefined;
      const quickActions = Array.isArray(body.quickActions)
        ? body.quickActions.map((c: unknown) => String(c || '').trim()).filter(Boolean)
        : undefined;
      const purposeConfig = body.purposeConfig && typeof body.purposeConfig === 'object' && !Array.isArray(body.purposeConfig)
        ? body.purposeConfig as Record<string, unknown>
        : undefined;
      const book = await ledgerCreateBook({
        uid: user.uid,
        email: user.email,
        name: String(body.name || ''),
        currency: String(body.currency || 'INR'),
        purposeId: body.purposeId ? String(body.purposeId) : undefined,
        purposeLabel: body.purposeLabel ? String(body.purposeLabel) : undefined,
        categories,
        quickActions,
        purposeConfig,
      });
      apiJson(res, 200, { book });
      return;
    }

    if (op === 'update') {
      const bookId = String(body.bookId || '').trim();
      if (!bookId) throw new ApiError(400, 'Missing ledger');
      const patch = body.patch && typeof body.patch === 'object' && !Array.isArray(body.patch)
        ? body.patch as Record<string, unknown>
        : {};
      if (patch.roles) await ledgerRequireManager(bookId, user.uid);
      else await ledgerRequireMember(bookId, user.uid);
      const book = await ledgerUpdateBook(bookId, user.uid, patch);
      apiJson(res, 200, { book });
      return;
    }

    if (op === 'removeMember') {
      const bookId = String(body.bookId || '').trim();
      const uidToRemove = String(body.uidToRemove || '').trim();
      if (!bookId || !uidToRemove) throw new ApiError(400, 'Missing member');
      const book = await ledgerRemoveMember(bookId, user.uid, uidToRemove);
      apiJson(res, 200, { book });
      return;
    }

    if (op === 'softDelete') {
      const bookId = String(body.bookId || '').trim();
      if (!bookId) throw new ApiError(400, 'Missing ledger');
      await ledgerSoftDeleteBook(bookId, user.uid);
      apiJson(res, 200, { ok: true });
      return;
    }

    if (op === 'ensureMailbox') {
      const bookId = String(body.bookId || '').trim();
      if (!bookId) throw new ApiError(400, 'Missing ledger');
      const book = await ledgerGetBookForUser(bookId, user.uid);
      const mailbox = await ledgerEnsureMailbox(bookId, book);
      await ledgerAudit({
        bookId,
        actorUid: user.uid,
        actorEmail: user.email,
        action: 'ledger.ensure_mailbox',
        entityType: 'book',
        entityId: bookId,
      });
      apiJson(res, 200, { mailbox, book: await ledgerGetBookForUser(bookId, user.uid) });
      return;
    }

    if (op === 'mailList') {
      const bookId = String(body.bookId || '').trim();
      if (!bookId) throw new ApiError(400, 'Missing ledger');
      await ledgerRequireMember(bookId, user.uid);
      apiJson(res, 200, await ledgerListMailEvents(bookId));
      return;
    }

    if (op === 'auditList') {
      const bookId = String(body.bookId || '').trim();
      apiJson(res, 200, { events: await ledgerListAudit(user.uid, bookId || undefined, Number(body.limit || 80)) });
      return;
    }

    if (op === 'mailAdd') {
      const bookId = String(body.bookId || '').trim();
      if (!bookId) throw new ApiError(400, 'Missing ledger');
      await ledgerRequireMember(bookId, user.uid);
      const event = body.event && typeof body.event === 'object' && !Array.isArray(body.event)
        ? body.event as Record<string, unknown>
        : {};
      const saved = await ledgerAddEmailEvent(bookId, event);
      apiJson(res, 200, { event: saved });
      return;
    }

    throw new ApiError(400, 'Unknown ledger operation');
  });
}

async function handleExpenses(req: VercelRequest, res: VercelResponse) {
  await withDomainApi(req, res, async (user, body) => {
    const op = String(body.op || '');

    if (op === 'list') {
      const bookId = String(body.bookId || '').trim();
      if (!bookId) throw new ApiError(400, 'Missing ledger');
      await ledgerRequireMember(bookId, user.uid);
      apiJson(res, 200, { expenses: await ledgerListLiveExpenses(bookId) });
      return;
    }

    if (op === 'listAll') {
      const books = await ledgerListBooksForUser(user.uid);
      const grouped = await ledgerListExpensesByBooks(books.map((book) => String(book.id)));
      const expenses = books.flatMap((book) => {
        const rows = grouped.get(`books/${book.id}/expenses`) || [];
        return rows.map((row) => ({
          id: row.id,
          bookId: book.id,
          bookName: book.name,
          currency: book.currency,
          ...row.data,
        }));
      }).sort((a, b) => {
        const ta = Date.parse(String((a as any).createdAt || '')) || 0;
        const tb = Date.parse(String((b as any).createdAt || '')) || 0;
        return tb - ta;
      });
      apiJson(res, 200, { books, expenses });
      return;
    }

    if (op === 'get') {
      const bookId = String(body.bookId || '').trim();
      const expenseId = String(body.expenseId || '').trim();
      if (!bookId || !expenseId) throw new ApiError(400, 'Missing expense');
      await ledgerRequireMember(bookId, user.uid);
      const expense = await ledgerGetExpense(bookId, expenseId);
      if (!expense) throw new ApiError(404, 'Expense not found');
      apiJson(res, 200, { expense });
      return;
    }

    if (op === 'checkDuplicate') {
      const bookId = String(body.bookId || '').trim();
      if (!bookId) throw new ApiError(400, 'Missing ledger');
      await ledgerRequireMember(bookId, user.uid);
      const input = body.expense && typeof body.expense === 'object' && !Array.isArray(body.expense)
        ? body.expense as Record<string, unknown>
        : {};
      apiJson(res, 200, { matches: await ledgerFindDuplicateExpense(bookId, input) });
      return;
    }

    if (op === 'create') {
      const bookId = String(body.bookId || '').trim();
      if (!bookId) throw new ApiError(400, 'Missing ledger');
      await ledgerRequireWriter(bookId, user.uid);
      const idempotencyKey = String(body.idempotencyKey || '').trim();
      if (idempotencyKey) {
        try {
          const { checkExpenseIdempotency } = await moneyModule();
          const cached = await checkExpenseIdempotency(bookId, user.uid, idempotencyKey);
          if (cached?.expense) {
            apiJson(res, 200, { expense: cached.expense, idempotent: true });
            return;
          }
        } catch {
          /* idempotency optional if money module unavailable */
        }
      }
      const input = body.expense && typeof body.expense === 'object' && !Array.isArray(body.expense)
        ? body.expense as Record<string, unknown>
        : {};
      const amt = Number(input.amount || 0);
      if (!Number.isFinite(amt) || amt < 0) throw new ApiError(400, 'Amount cannot be negative');
      if (!body.force) {
        const matches = await ledgerFindDuplicateExpense(bookId, input);
        if (matches.length) throw new ApiError(409, 'A matching entry is already on this ledger', { matches });
      }
      const now = new Date().toISOString();
      const paidDate = String(input.paidAt || input.date || now.slice(0, 10)).slice(0, 10);
      const saved = await ledgerSaveExpense(bookId, {
        ...input,
        date: paidDate,
        paidAt: paidDate,
        enteredByUid: user.uid,
        enteredByEmail: user.email,
        // Record creation is always "now" — never reuse receipt/paid date as createdAt.
        createdAt: now,
        status: Number(input.amount || 0) > 0 ? (input.status || 'recorded') : 'draft',
        financialStatus: input.financialStatus || 'CONFIRMED',
        processingStatus: input.processingStatus || 'COMPLETED',
        idempotencyKey: idempotencyKey || undefined,
        ...(body.force ? { duplicateConfirmedDifferent: true } : {}),
      }, { insertOnly: true, allowDuplicateHash: Boolean(body.force) });
      await mergeCategory(bookId, String((saved.expense as Record<string, unknown>).category || '')).catch(() => undefined);
      await ledgerAudit({
        bookId,
        actorUid: user.uid,
        actorEmail: user.email,
        action: 'expense.create',
        entityType: 'expense',
        entityId: String(saved.expense.id),
      });
      if (idempotencyKey) {
        try {
          const { storeExpenseIdempotency } = await moneyModule();
          await storeExpenseIdempotency(bookId, user.uid, idempotencyKey, { expense: saved.expense });
        } catch {
          /* ignore */
        }
      }
      const created = saved.expense as Record<string, unknown>;
      await notifyBookMembersPush(bookId, user.uid, {
        title: 'Byjan',
        body: `${user.email || 'A teammate'} added ${String(created.description || created.merchant || 'an entry')}`,
        action: 'entry.create',
      });
      apiJson(res, 200, { expense: saved.expense });
      return;
    }

    if (op === 'update') {
      const bookId = String(body.bookId || '').trim();
      const expenseId = String(body.expenseId || body.expense && (body.expense as { id?: string }).id || '').trim();
      if (!bookId || !expenseId) throw new ApiError(400, 'Missing expense');
      await ledgerRequireWriter(bookId, user.uid);
      const current = await ledgerGetExpense(bookId, expenseId);
      if (!current) throw new ApiError(404, 'Expense not found');
      const patch = body.expense && typeof body.expense === 'object' && !Array.isArray(body.expense)
        ? body.expense as Record<string, unknown>
        : {};
      const saved = await ledgerSaveExpense(bookId, {
        ...current,
        ...patch,
        id: expenseId,
        // Paid / transaction date can change; never rewrite when the record was created.
        createdAt: current.createdAt,
        date: String(patch.paidAt || patch.date || current.paidAt || current.date || '').slice(0, 10) || current.date,
        paidAt: String(patch.paidAt || patch.date || current.paidAt || current.date || '').slice(0, 10) || current.paidAt || current.date,
        lastEditedByUid: user.uid,
        lastEditedAt: new Date().toISOString(),
      });
      await mergeCategory(bookId, String((saved.expense as Record<string, unknown>).category || '')).catch(() => undefined);
      await ledgerAudit({
        bookId,
        actorUid: user.uid,
        actorEmail: user.email,
        action: 'expense.update',
        entityType: 'expense',
        entityId: expenseId,
      });
      const updated = saved.expense as Record<string, unknown>;
      await notifyBookMembersPush(bookId, user.uid, {
        title: 'Byjan',
        body: `${user.email || 'A teammate'} updated ${String(updated.description || updated.merchant || 'an entry')}`,
        action: 'entry.update',
      });
      apiJson(res, 200, { expense: saved.expense });
      return;
    }

    if (op === 'softDelete') {
      const bookId = String(body.bookId || '').trim();
      const expenseId = String(body.expenseId || '').trim();
      if (!bookId || !expenseId) throw new ApiError(400, 'Missing expense');
      await ledgerRequireWriter(bookId, user.uid);
      const ok = await ledgerSoftDeleteExpense(bookId, expenseId, user.uid);
      if (!ok) throw new ApiError(404, 'Expense not found');
      await ledgerAudit({
        bookId,
        actorUid: user.uid,
        actorEmail: user.email,
        action: 'expense.soft_delete',
        entityType: 'expense',
        entityId: expenseId,
      });
      await notifyBookMembersPush(bookId, user.uid, {
        title: 'Byjan',
        body: `${user.email || 'A teammate'} deleted an entry`,
        action: 'entry.delete',
      });
      apiJson(res, 200, { ok: true });
      return;
    }

    throw new ApiError(400, 'Unknown expense operation');
  });
}

async function handleNotifications(req: VercelRequest, res: VercelResponse) {
  await withDomainApi(req, res, async (user, body) => {
    const op = String(body.op || '');

    if (op === 'list') {
      apiJson(res, 200, { notifications: await ledgerListNotifications(user.uid) });
      return;
    }

    if (op === 'markRead') {
      const id = String(body.id || '').trim();
      if (!id) throw new ApiError(400, 'Missing notification');
      const notification = await ledgerMarkNotificationRead(id, user.uid);
      apiJson(res, 200, { notification });
      return;
    }

    if (op === 'markAllRead') {
      const result = await ledgerMarkAllNotificationsRead(user.uid);
      apiJson(res, 200, result);
      return;
    }

    if (op === 'registerPush') {
      const token = String(body.token || '').trim();
      if (!token) throw new ApiError(400, 'Missing token');
      await ledgerUpsertUser(user.uid, {
        pushToken: token,
        pushPlatform: String(body.platform || ''),
        pushUpdatedAt: new Date().toISOString(),
      }, true);
      apiJson(res, 200, { ok: true });
      return;
    }

    if (op === 'pingSelf') {
      const profile = await ledgerGetUser(user.uid);
      const pushToken = String(profile?.pushToken || '').trim();
      if (!pushToken) throw new ApiError(400, 'No push token on this account yet. Open the Android app while signed in, then try again.');
      await ledgerAddNotification({
        userId: user.uid,
        bookId: '',
        bookName: 'Byjan',
        kind: 'system',
        action: 'Test notification',
        detail: 'Sent to this device from Byjan',
        link: '/',
        createdAt: new Date().toISOString(),
        read: false,
      });
      const { sendFcm } = await pushModule();
      const fcm = await sendFcm(pushToken, {
        title: 'Byjan',
        body: 'Test alert — pending payments and books are on Home',
        data: { url: '/#/' },
      });
      apiJson(res, 200, { ok: Boolean(fcm?.ok), sent: Boolean(fcm?.ok), fcm: fcm?.ok ? 'sent' : (fcm?.error || 'failed') });
      return;
    }

    if (op === 'create') {
      const targetUid = String(body.userId || '').trim();
      const bookId = String(body.bookId || '').trim();
      if (!targetUid || !bookId) throw new ApiError(400, 'Missing notification target');
      const member = await ledgerMember(bookId, user.uid);
      const target = await ledgerMember(bookId, targetUid);
      if (!member || !target) throw new ApiError(403, 'Not allowed to notify this user');
      const notification = await ledgerAddNotification({
        userId: targetUid,
        bookId,
        bookName: String(body.bookName || ''),
        kind: String(body.kind || 'entry'),
        action: String(body.action || ''),
        detail: String(body.detail || ''),
        senderName: String(body.senderName || user.email),
        ledgerMail: String(body.ledgerMail || ''),
        settlementId: String(body.settlementId || ''),
        link: String(body.link || ''),
        createdAt: new Date().toISOString(),
        read: false,
      });
      const profile = await ledgerGetUser(targetUid);
      const pushToken = String(profile?.pushToken || '').trim();
      if (pushToken && body.skipPush !== true) {
        try {
          const { sendFcm } = await pushModule();
          const settlementId = String(body.settlementId || '');
          const path = String(body.link || (settlementId ? `/book/${bookId}?pay=${encodeURIComponent(settlementId)}` : `/book/${bookId}`));
          await sendFcm(pushToken, {
            title: String(body.bookName || 'Byjan'),
            body: `${String(body.senderName || user.email)} ${String(body.action || 'updated the book').toLowerCase()}`,
            data: {
              bookId,
              settlementId,
              url: `/#${path.startsWith('/') ? path : `/${path}`}`,
            },
          });
        } catch (err) {
          console.error('notification FCM failed', targetUid, err);
        }
      } else if (!pushToken) {
        console.error('FCM skip: no push token', targetUid);
      }
      apiJson(res, 200, { notification });
      return;
    }

    throw new ApiError(400, 'Unknown notification operation');
  });
}

const ACCESS_FEATURE_KEYS = [
  'money',
  'money_capture',
  'money_add',
  'money_scan',
  'money_voice',
  'money_duplicate',
  'money_flag',
  'money_delete',
  'money_team',
  'money_people',
  'money_settle',
  'money_split',
  'money_split_tab',
  'money_split_entry',
  'money_split_equal',
  'money_email',
  'money_email_tab',
  'money_email_mailbox',
  'money_email_send',
  'money_announce',
  'money_email_report',
  'money_insight',
  'money_export',
  'money_reports',
  'money_book_analytics',
  'money_history',
  'money_live',
  'money_activity',
  'money_inbox',
  'money_recurring',
  'money_setup',
  'money_create_book',
  'money_delete_book',
  'money_purpose',
  'money_search',
  'money_pin',
  'money_budget',
  'money_filters',
  'app_notifications',
  'app_notifications_bell',
  'app_notifications_push',
  'app_notifications_email',
  'app_lock',
  'app_search',
  'business',
  'sales',
  'buying',
  'bank',
  'accounts',
  'operations',
  'tax',
  'reports',
  'company_settings',
] as const;

const MEMBER_FEATURE_DEFAULTS: Record<string, boolean> = {
  money: true,
  money_capture: true,
  money_add: true,
  money_scan: true,
  money_voice: true,
  money_duplicate: true,
  money_flag: true,
  money_people: false,
  money_settle: false,
  money_split: true,
  money_split_tab: true,
  money_split_entry: true,
  money_split_equal: true,
  money_email: true,
  money_email_tab: true,
  money_email_mailbox: true,
  money_email_send: false,
  money_announce: false,
  money_email_report: false,
  money_export: false,
  money_delete: false,
  money_insight: true,
  money_reports: true,
  money_book_analytics: true,
  money_history: true,
  money_live: true,
  money_activity: true,
  money_inbox: true,
  money_recurring: true,
  money_setup: true,
  money_create_book: true,
  money_delete_book: false,
  money_purpose: true,
  money_search: true,
  money_pin: false,
  money_budget: false,
  money_filters: true,
  app_notifications: true,
  app_notifications_bell: true,
  app_notifications_push: true,
  app_notifications_email: true,
  app_lock: false,
  app_search: true,
  business: false,
  sales: false,
  buying: false,
  bank: false,
  accounts: false,
  operations: false,
  tax: false,
  reports: false,
  company_settings: false,
};

function isAllowedFeatureKey(key: string) {
  return ACCESS_FEATURE_KEYS.includes(key as typeof ACCESS_FEATURE_KEYS[number])
    || /^(money|app|sales|buying|bank|accounts|operations|tax|reports|company_settings)_[a-z0-9_]+$/.test(key)
    || /^act_[a-z0-9_]+$/.test(key);
}

function sanitizeAccessFeatures(raw: unknown, superUser = false) {
  const next: Record<string, boolean> = {};
  for (const key of ACCESS_FEATURE_KEYS) {
    next[key] = superUser ? true : Boolean(MEMBER_FEATURE_DEFAULTS[key]);
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const rec = raw as Record<string, unknown>;
    for (const [key, value] of Object.entries(rec)) {
      if (isAllowedFeatureKey(key)) next[key] = Boolean(value);
    }
  }
  if (!next.money) {
    for (const key of Object.keys(next)) {
      if (key.startsWith('money_')) next[key] = false;
    }
  }
  if (!next.business) {
    for (const key of ['sales', 'buying', 'bank', 'accounts', 'operations', 'tax', 'reports', 'company_settings']) {
      next[key] = false;
    }
    for (const key of Object.keys(next)) {
      if (key.startsWith('act_')) next[key] = false;
    }
  }
  return next;
}

function storedAccessFeatures(raw: unknown): Record<string, boolean> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const rec = raw as Record<string, unknown>;
  const next: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(rec)) {
    if (isAllowedFeatureKey(key)) next[key] = Boolean(value);
  }
  return Object.keys(next).length ? next : undefined;
}

async function loadRolePermissionsMap() {
  try {
    const sql = await getLedgerSql();
    await sql`CREATE TABLE IF NOT EXISTS role_permissions (
      role_key TEXT PRIMARY KEY,
      features JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
    const rows = await sql`SELECT role_key, features FROM role_permissions`;
    const map: Record<string, Record<string, boolean>> = {};
    for (const row of (Array.isArray(rows) ? rows : []) as Array<{ role_key?: string; features?: unknown }>) {
      const key = String(row.role_key || '').trim();
      if (!key) continue;
      const stored = storedAccessFeatures(row.features);
      if (stored) map[key] = stored;
    }
    return map;
  } catch {
    return {} as Record<string, Record<string, boolean>>;
  }
}

function bookRoles(book: Record<string, unknown>) {
  const roles = book.roles;
  if (!roles || typeof roles !== 'object' || Array.isArray(roles)) return {} as Record<string, { role?: string; email?: string }>;
  return roles as Record<string, { role?: string; email?: string }>;
}

function actorCanSetFeatures(actorEmail: string, targetUid: string) {
  if (!emailIsSuperUser(actorEmail)) return false;
  return Boolean(targetUid);
}

async function handleMe(req: VercelRequest, res: VercelResponse) {
  await withDomainApi(req, res, async (user, body) => {
    const op = String(body.op || 'get');

    if (op === 'get') {
      const profile = await ledgerGetUser(user.uid);
      const base = profile || { uid: user.uid, email: user.email };
      const superUser = emailIsSuperUser(user.email);
      const stored = storedAccessFeatures(profile?.features);
      const rolePermissions = await loadRolePermissionsMap();
      apiJson(res, 200, {
        rolePermissions,
        user: {
          ...base,
          isSuperUser: superUser,
          hasFeatureOverride: Boolean(stored),
          features: stored,
        },
      });
      return;
    }

    if (op === 'people') {
      if (!emailIsSuperUser(user.email)) throw new ApiError(403, 'Only a super user can view access people.');
      const books = await ledgerListBooksForUser(user.uid);
      const ids = new Set<string>();
      const emails: Record<string, string> = {};
      for (const book of books) {
        const roles = bookRoles(book);
        for (const [uid, row] of Object.entries(roles)) {
          ids.add(uid);
          if (row?.email) emails[uid] = String(row.email);
        }
        if (book.ownerId) ids.add(String(book.ownerId));
      }
      const people = await Promise.all([...ids].map(async (uid) => {
        const profile = await ledgerGetUser(uid);
        const email = String(profile?.email || emails[uid] || '');
        const stored = storedAccessFeatures(profile?.features);
        return {
          uid,
          email,
          displayName: String(profile?.displayName || email.split('@')[0] || 'Person'),
          hasFeatureOverride: Boolean(stored),
          features: stored,
        };
      }));
      people.sort((a, b) => a.displayName.localeCompare(b.displayName) || a.email.localeCompare(b.email));
      apiJson(res, 200, { people });
      return;
    }

    if (op === 'setFeatures') {
      const targetUid = String(body.userId || body.targetUid || '').trim();
      if (!targetUid) throw new ApiError(400, 'Missing person');
      if (targetUid === user.uid) throw new ApiError(400, 'You cannot change your own access.');
      if (!actorCanSetFeatures(user.email, targetUid)) {
        throw new ApiError(403, 'Only a super user can change access.');
      }
      const features = sanitizeAccessFeatures(body.features);
      const saved = await ledgerUpsertUser(targetUid, {
        features,
        updatedAt: new Date().toISOString(),
      }, true);
      await ledgerAudit({
        actorUid: user.uid,
        actorEmail: user.email,
        action: 'user.features',
        entityType: 'user',
        entityId: targetUid,
      });
      apiJson(res, 200, { user: { ...saved, features } });
      return;
    }

    if (op === 'upsert') {
      const patch = body.patch && typeof body.patch === 'object' && !Array.isArray(body.patch)
        ? { ...(body.patch as Record<string, unknown>) }
        : {};
      delete patch.features;
      const saved = await ledgerUpsertUser(user.uid, {
        ...patch,
        uid: user.uid,
        email: String(patch.email || user.email),
        updatedAt: new Date().toISOString(),
      }, true);
      await ledgerAudit({
        actorUid: user.uid,
        actorEmail: user.email,
        action: 'user.upsert',
        entityType: 'user',
        entityId: user.uid,
      });
      apiJson(res, 200, { user: saved });
      return;
    }

    throw new ApiError(400, 'Unknown profile operation');
  });
}

function applyDocPatch(current: Record<string, unknown>, patch: Record<string, unknown>) {
  const next: Record<string, unknown> = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (key.includes('.')) {
      const parts = key.split('.');
      let cur: any = next;
      for (let i = 0; i < parts.length - 1; i++) {
        const piece = cur[parts[i]];
        cur[parts[i]] = piece && typeof piece === 'object' && !Array.isArray(piece) ? { ...piece } : {};
        cur = cur[parts[i]];
      }
      cur[parts[parts.length - 1]] = value;
    } else {
      next[key] = value;
    }
  }
  return next;
}

function getAt(obj: any, field: string) {
  return field.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

function applyBooksConstraints(docs: { id: string; data: Record<string, unknown> }[], constraints: any[] = []) {
  let next = docs;
  for (const c of constraints) {
    if (c.type === 'where' && c.op === '==') next = next.filter((row) => getAt({ id: row.id, ...row.data }, c.field) === c.value);
    else if (c.type === 'where' && c.op === 'in') {
      const allowed = Array.isArray(c.value) ? c.value : [];
      next = next.filter((row) => allowed.includes(getAt({ id: row.id, ...row.data }, c.field)));
    } else if (c.type === 'limit') next = next.slice(0, Number(c.n) || next.length);
  }
  return next;
}

function packBooksCollections(docs: Record<string, Record<string, unknown>>) {
  const grouped: Record<string, { id: string; data: Record<string, unknown> }[]> = {};
  for (const [rel, data] of Object.entries(docs)) {
    const cut = rel.lastIndexOf('/');
    if (cut < 0) {
      (grouped[rel] ||= []).push({ id: rel, data });
      continue;
    }
    const col = rel.slice(0, cut);
    const id = rel.slice(cut + 1);
    if (!id || id.includes('/')) continue;
    (grouped[col] ||= []).push({ id, data });
  }
  return grouped;
}

function booksId() {
  return Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

async function handleBooks(req: VercelRequest, res: VercelResponse) {
  await withDomainApi(req, res, async (user, body) => {
    const op = String(body.op || '');
    const path = String(body.path || '').replace(/^\/+|\/+$/g, '');

    if (op === 'workspace') {
      const bits = path.split('/').filter(Boolean);
      const ws = bits[0] === 'erp_workspaces' ? bits[1] : bits[0];
      if (!ws) throw new ApiError(400, 'Missing workspace');
      assertErpWorkspace(user.uid, `erp_workspaces/${ws}`);
      const loaded = await erpLoadWorkspace(ws);
      apiJson(res, 200, {
        tenant: loaded.tenant,
        collections: packBooksCollections(loaded.docs as Record<string, Record<string, unknown>>),
      });
      return;
    }

    if (!path) {
      if (op !== 'queryMany' && op !== 'batch') throw new ApiError(400, 'Missing path');
    } else {
      assertErpWorkspace(user.uid, path);
    }

    if (op === 'get') {
      const data = await ledgerGet(path);
      apiJson(res, 200, { exists: Boolean(data), id: path.split('/').pop(), data });
      return;
    }

    if (op === 'set') {
      const incoming = (body.data && typeof body.data === 'object' && !Array.isArray(body.data))
        ? body.data as Record<string, unknown>
        : {};
      const next = body.merge ? { ...((await ledgerGet(path)) || {}), ...incoming } : incoming;
      await ledgerSet(path, next);
      await ledgerAudit({
        bookId: assertErpWorkspace(user.uid, path),
        actorUid: user.uid,
        actorEmail: user.email,
        action: 'books.set',
        entityType: 'erp_record',
        entityId: path,
      }).catch(() => undefined);
      apiJson(res, 200, { ok: true, id: path.split('/').pop(), data: next });
      return;
    }

    if (op === 'update') {
      const current = (await ledgerGet(path)) || {};
      const patch = (body.data && typeof body.data === 'object' && !Array.isArray(body.data))
        ? body.data as Record<string, unknown>
        : {};
      const next = applyDocPatch(current, patch);
      await ledgerSet(path, next);
      await ledgerAudit({
        bookId: assertErpWorkspace(user.uid, path),
        actorUid: user.uid,
        actorEmail: user.email,
        action: 'books.update',
        entityType: 'erp_record',
        entityId: path,
      }).catch(() => undefined);
      apiJson(res, 200, { ok: true, data: next });
      return;
    }

    if (op === 'delete') {
      await ledgerDel(path);
      await ledgerAudit({
        bookId: assertErpWorkspace(user.uid, path),
        actorUid: user.uid,
        actorEmail: user.email,
        action: 'books.soft_delete',
        entityType: 'erp_record',
        entityId: path,
      }).catch(() => undefined);
      apiJson(res, 200, { ok: true });
      return;
    }

    if (op === 'add') {
      const requested = String(body.id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48);
      const id = requested || booksId();
      const data = { ...((body.data && typeof body.data === 'object' && !Array.isArray(body.data)) ? body.data as Record<string, unknown> : {}), id };
      await ledgerSet(`${path}/${id}`, data);
      apiJson(res, 200, { id, data });
      return;
    }

    if (op === 'list' || op === 'query') {
      const constraints = Array.isArray(body.constraints) ? body.constraints : [];
      apiJson(res, 200, { docs: applyBooksConstraints(await ledgerList(path, constraints), constraints) });
      return;
    }

    if (op === 'batch') {
      const writes = Array.isArray(body.writes) ? body.writes.slice(0, 80) : [];
      let count = 0;
      for (const write of writes) {
        const writePath = String(write?.path || '').replace(/^\/+|\/+$/g, '');
        if (!writePath) continue;
        assertErpWorkspace(user.uid, writePath);
        const writeOp = String(write?.op || '');
        if (writeOp === 'set') {
          const incoming = (write.data && typeof write.data === 'object' && !Array.isArray(write.data))
            ? write.data as Record<string, unknown>
            : {};
          const next = write.merge ? { ...((await ledgerGet(writePath)) || {}), ...incoming } : incoming;
          await ledgerSet(writePath, next);
          count += 1;
        } else if (writeOp === 'update') {
          const current = (await ledgerGet(writePath)) || {};
          const patch = (write.data && typeof write.data === 'object' && !Array.isArray(write.data))
            ? write.data as Record<string, unknown>
            : {};
          await ledgerSet(writePath, applyDocPatch(current, patch));
          count += 1;
        }
      }
      await ledgerAudit({
        actorUid: user.uid,
        actorEmail: user.email,
        action: 'books.batch',
        entityType: 'erp_record',
        detail: { count },
      }).catch(() => undefined);
      apiJson(res, 200, { ok: true, count });
      return;
    }

    if (op === 'queryMany') {
      const queries = Array.isArray(body.queries) ? body.queries.slice(0, 24) : [];
      const parsed = queries.map((item: any) => ({
        qPath: String(item?.path || '').replace(/^\/+|\/+$/g, ''),
        constraints: Array.isArray(item?.constraints) ? item.constraints : [],
      }));
      const wsIds = [...new Set(parsed.map((row) => {
        const bits = row.qPath.split('/').filter(Boolean);
        return bits[0] === 'erp_workspaces' ? bits[1] : '';
      }).filter(Boolean))];
      if (wsIds.length === 1 && parsed.every((row) => row.qPath.startsWith('erp_workspaces/'))) {
        const ws = String(wsIds[0] || '');
        assertErpWorkspace(user.uid, `erp_workspaces/${ws}`);
        const loaded = await erpLoadWorkspace(ws);
        const grouped = packBooksCollections(loaded.docs as Record<string, Record<string, unknown>>);
        apiJson(res, 200, {
          results: parsed.map((row) => {
            const col = row.qPath.split('/').filter(Boolean).slice(2).join('/');
            return { path: row.qPath, docs: applyBooksConstraints(grouped[col] || [], row.constraints) };
          }),
        });
        return;
      }
      const results = [];
      for (const row of parsed) {
        if (!row.qPath) {
          results.push({ path: row.qPath, docs: [] });
          continue;
        }
        assertErpWorkspace(user.uid, row.qPath);
        results.push({ path: row.qPath, docs: applyBooksConstraints(await ledgerList(row.qPath, row.constraints), row.constraints) });
      }
      apiJson(res, 200, { results });
      return;
    }

    throw new ApiError(400, 'Unknown Books operation');
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const domain = domainFrom(req);
  if (domain === 'ledgers') return handleLedgers(req, res);
  if (domain === 'expenses') return handleExpenses(req, res);
  if (domain === 'notifications') return handleNotifications(req, res);
  if (domain === 'me') return handleMe(req, res);
  if (domain === 'books') return handleBooks(req, res);
  if (domain === 'money') {
    try {
      const { handleMoney } = await moneyModule();
      return handleMoney(req, res);
    } catch (err) {
      const origin = String(req.headers.origin || '');
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
      if (origin) res.setHeader('Access-Control-Allow-Credentials', 'true');
      apiJson(res, 500, { error: err instanceof Error ? err.message : 'Money API unavailable' });
      return;
    }
  }

  const origin = String(req.headers.origin || '');
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  if (origin) res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  apiJson(res, 404, { error: 'Unknown tracker API' });
}

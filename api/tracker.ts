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
  withDomainApi,
} from './_pg-tables.js';

type Domain = 'ledgers' | 'expenses' | 'notifications' | 'me';

function domainFrom(req: VercelRequest): Domain | '' {
  const raw = req.query?.domain;
  const query = Array.isArray(raw) ? raw[0] : raw;
  const hinted = String(query || '').trim();
  if (hinted === 'ledgers' || hinted === 'expenses' || hinted === 'notifications' || hinted === 'me') return hinted;
  try {
    const path = new URL(req.url || '/', 'https://local.invalid').pathname;
    const part = path.split('/').filter(Boolean)[1] || '';
    if (part === 'ledgers' || part === 'expenses' || part === 'notifications' || part === 'me') return part;
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
      const book = await ledgerCreateBook({
        uid: user.uid,
        email: user.email,
        name: String(body.name || ''),
        currency: String(body.currency || 'INR'),
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

    if (op === 'create') {
      const bookId = String(body.bookId || '').trim();
      if (!bookId) throw new ApiError(400, 'Missing ledger');
      await ledgerRequireWriter(bookId, user.uid);
      const input = body.expense && typeof body.expense === 'object' && !Array.isArray(body.expense)
        ? body.expense as Record<string, unknown>
        : {};
      const now = new Date().toISOString();
      const saved = await ledgerSaveExpense(bookId, {
        ...input,
        enteredByUid: user.uid,
        enteredByEmail: user.email,
        createdAt: String(input.createdAt || now),
        status: Number(input.amount || 0) > 0 ? (input.status || 'recorded') : 'draft',
      }, { insertOnly: true });
      await mergeCategory(bookId, String(saved.expense.category || '')).catch(() => undefined);
      await ledgerAudit({
        bookId,
        actorUid: user.uid,
        actorEmail: user.email,
        action: 'expense.create',
        entityType: 'expense',
        entityId: String(saved.expense.id),
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
        lastEditedByUid: user.uid,
        lastEditedAt: new Date().toISOString(),
      });
      await mergeCategory(bookId, String(saved.expense.category || '')).catch(() => undefined);
      await ledgerAudit({
        bookId,
        actorUid: user.uid,
        actorEmail: user.email,
        action: 'expense.update',
        entityType: 'expense',
        entityId: expenseId,
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
        link: String(body.link || ''),
        createdAt: new Date().toISOString(),
        read: false,
      });
      apiJson(res, 200, { notification });
      return;
    }

    throw new ApiError(400, 'Unknown notification operation');
  });
}

async function handleMe(req: VercelRequest, res: VercelResponse) {
  await withDomainApi(req, res, async (user, body) => {
    const op = String(body.op || 'get');

    if (op === 'get') {
      const profile = await ledgerGetUser(user.uid);
      apiJson(res, 200, { user: profile || { uid: user.uid, email: user.email } });
      return;
    }

    if (op === 'upsert') {
      const patch = body.patch && typeof body.patch === 'object' && !Array.isArray(body.patch)
        ? body.patch as Record<string, unknown>
        : {};
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const domain = domainFrom(req);
  if (domain === 'ledgers') return handleLedgers(req, res);
  if (domain === 'expenses') return handleExpenses(req, res);
  if (domain === 'notifications') return handleNotifications(req, res);
  if (domain === 'me') return handleMe(req, res);

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

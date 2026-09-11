import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  ApiError,
  apiJson,
  ledgerAudit,
  ledgerGet,
  ledgerGetExpense,
  ledgerListBooksForUser,
  ledgerListExpensesByBooks,
  ledgerListLiveExpenses,
  ledgerRequireMember,
  ledgerRequireWriter,
  ledgerSaveExpense,
  ledgerSet,
  ledgerSoftDeleteExpense,
  withDomainApi,
} from './_pg-tables.js';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

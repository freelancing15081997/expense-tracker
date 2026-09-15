import { apiPost } from './api';

export type LedgerExpense = {
  id: string;
  bookId?: string;
  bookName?: string;
  currency?: string;
  amount?: number;
  description?: string;
  category?: string;
  entryType?: string;
  [key: string]: unknown;
};

let listAllCache: { at: number; value: { expenses: LedgerExpense[]; books: Array<Record<string, unknown>> } } | null = null;

export async function listExpenses(bookId: string) {
  const payload = await apiPost<{ expenses?: LedgerExpense[] }>('/api/expenses', { op: 'list', bookId });
  return Array.isArray(payload.expenses) ? payload.expenses : [];
}

export async function listAllExpenses() {
  const now = Date.now();
  if (listAllCache && now - listAllCache.at < 25_000) {
    return listAllCache.value;
  }
  const payload = await apiPost<{ expenses?: LedgerExpense[]; books?: Array<Record<string, unknown>> }>('/api/expenses', {
    op: 'listAll',
  });
  const value = {
    expenses: Array.isArray(payload.expenses) ? payload.expenses : [],
    books: Array.isArray(payload.books) ? payload.books : [],
  };
  listAllCache = { at: now, value };
  return value;
}

export function clearExpensesListCache() {
  listAllCache = null;
}

export async function createExpense(bookId: string, expense: Record<string, unknown>, opts?: { force?: boolean; idempotencyKey?: string }) {
  listAllCache = null;
  const payload = await apiPost<{ expense: LedgerExpense }>('/api/expenses', {
    op: 'create',
    bookId,
    expense,
    force: Boolean(opts?.force),
    idempotencyKey: opts?.idempotencyKey || undefined,
  });
  return payload.expense;
}

export async function checkDuplicateExpense(bookId: string, expense: Record<string, unknown>) {
  const payload = await apiPost<{ matches?: LedgerExpense[] }>('/api/expenses', { op: 'checkDuplicate', bookId, expense });
  return Array.isArray(payload.matches) ? payload.matches : [];
}

export async function updateExpense(bookId: string, expenseId: string, expense: Record<string, unknown>) {
  const payload = await apiPost<{ expense: LedgerExpense }>('/api/expenses', {
    op: 'update',
    bookId,
    expenseId,
    expense: { ...expense, id: expenseId },
  });
  return payload.expense;
}

export async function softDeleteExpense(bookId: string, expenseId: string) {
  await apiPost('/api/expenses', { op: 'softDelete', bookId, expenseId });
}

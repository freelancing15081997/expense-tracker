import { apiPost } from './api';
import { auth } from './firebase';

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

type ListAllValue = { expenses: LedgerExpense[]; books: Array<Record<string, unknown>> };

let listAllCache: { uid: string; at: number; value: ListAllValue } | null = null;
let listAllInflight: { uid: string; promise: Promise<ListAllValue> } | null = null;

export async function listExpenses(bookId: string) {
  const payload = await apiPost<{ expenses?: LedgerExpense[] }>('/api/expenses', { op: 'list', bookId });
  return Array.isArray(payload.expenses) ? payload.expenses : [];
}

/** Single-flight + uid-scoped cache — Dashboard and search catalog share one network call. */
export async function listAllExpenses() {
  const uid = String(auth.currentUser?.uid || '');
  const now = Date.now();
  if (listAllCache && listAllCache.uid === uid && now - listAllCache.at < 45_000) {
    return listAllCache.value;
  }
  if (listAllInflight && listAllInflight.uid === uid) return listAllInflight.promise;

  const promise = (async () => {
    const payload = await apiPost<{ expenses?: LedgerExpense[]; books?: Array<Record<string, unknown>> }>('/api/expenses', {
      op: 'listAll',
    });
    const value: ListAllValue = {
      expenses: Array.isArray(payload.expenses) ? payload.expenses : [],
      books: Array.isArray(payload.books) ? payload.books : [],
    };
    // Never attach another account's response to this uid's cache.
    if (String(auth.currentUser?.uid || '') === uid) {
      listAllCache = { uid, at: Date.now(), value };
    }
    return value;
  })();

  listAllInflight = { uid, promise };
  try {
    return await promise;
  } finally {
    if (listAllInflight?.promise === promise) listAllInflight = null;
  }
}

export function clearExpensesListCache() {
  listAllCache = null;
  listAllInflight = null;
}

export async function createExpense(bookId: string, expense: Record<string, unknown>, opts?: { force?: boolean; idempotencyKey?: string }) {
  clearExpensesListCache();
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
  clearExpensesListCache();
  const payload = await apiPost<{ expense: LedgerExpense }>('/api/expenses', {
    op: 'update',
    bookId,
    expenseId,
    expense: { ...expense, id: expenseId },
  });
  return payload.expense;
}

export async function softDeleteExpense(bookId: string, expenseId: string) {
  clearExpensesListCache();
  await apiPost('/api/expenses', { op: 'softDelete', bookId, expenseId });
}

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

export async function listExpenses(bookId: string) {
  const payload = await apiPost<{ expenses?: LedgerExpense[] }>('/api/expenses', { op: 'list', bookId });
  return Array.isArray(payload.expenses) ? payload.expenses : [];
}

export async function listAllExpenses() {
  const payload = await apiPost<{ expenses?: LedgerExpense[]; books?: Array<Record<string, unknown>> }>('/api/expenses', {
    op: 'listAll',
  });
  return {
    expenses: Array.isArray(payload.expenses) ? payload.expenses : [],
    books: Array.isArray(payload.books) ? payload.books : [],
  };
}

export async function createExpense(bookId: string, expense: Record<string, unknown>) {
  const payload = await apiPost<{ expense: LedgerExpense }>('/api/expenses', { op: 'create', bookId, expense });
  return payload.expense;
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

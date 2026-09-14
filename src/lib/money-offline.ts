/** Offline capture queue — client UUID + idempotency for sync when back online. */

import { createExpense } from './expenses';
import { newMoneyId } from './money-core';

const STORAGE_KEY = 'byjan_offline_queue_v1';

export type OfflineQueuedExpense = {
  id: string;
  bookId: string;
  expense: Record<string, unknown>;
  idempotencyKey: string;
  createdAt: string;
  attempts: number;
  lastError?: string;
};

function readQueue(): OfflineQueuedExpense[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(rows: OfflineQueuedExpense[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows.slice(0, 200)));
  } catch {
    /* quota */
  }
}

export function listOfflineQueue(bookId?: string) {
  const rows = readQueue();
  return bookId ? rows.filter((r) => r.bookId === bookId) : rows;
}

export function enqueueOfflineExpense(bookId: string, expense: Record<string, unknown>) {
  const id = newMoneyId('off');
  const idempotencyKey = String(expense.idempotencyKey || newMoneyId('exp'));
  const row: OfflineQueuedExpense = {
    id,
    bookId,
    expense: { ...expense, idempotencyKey, offlineQueued: true },
    idempotencyKey,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  writeQueue([row, ...readQueue()]);
  return row;
}

export function removeOfflineExpense(id: string) {
  writeQueue(readQueue().filter((r) => r.id !== id));
}

export async function flushOfflineQueue(bookId?: string) {
  const rows = listOfflineQueue(bookId);
  const results: Array<{ id: string; ok: boolean; expense?: Record<string, unknown>; error?: string }> = [];
  for (const row of rows) {
    try {
      const expense = await createExpense(row.bookId, row.expense, {
        force: Boolean(row.expense.force),
        idempotencyKey: row.idempotencyKey,
      });
      removeOfflineExpense(row.id);
      results.push({ id: row.id, ok: true, expense: expense as Record<string, unknown> });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed';
      const next = readQueue().map((r) => (
        r.id === row.id ? { ...r, attempts: r.attempts + 1, lastError: message } : r
      ));
      writeQueue(next);
      results.push({ id: row.id, ok: false, error: message });
    }
  }
  return results;
}

export function isLikelyOfflineError(err: unknown) {
  if (!err || typeof err !== 'object') return false;
  const message = String((err as Error).message || '').toLowerCase();
  return message.includes('failed to fetch')
    || message.includes('network')
    || message.includes('offline')
    || (err as { status?: number }).status === 0;
}

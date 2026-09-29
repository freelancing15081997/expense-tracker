import { auth } from './firebase';
import { readUserLocalJson, writeUserLocalJson } from './user-cache';

export function isHydratedBook(book: any) {
  return Boolean(book && book.id && (book.roles || book.ownerId));
}

export function writeBookSnapshot(book: any, uid = auth.currentUser?.uid) {
  const user = String(uid || '');
  if (!user || !isHydratedBook(book)) return;
  writeUserLocalJson(user, `book_snap_${book.id}`, {
    id: book.id,
    name: book.name,
    currency: book.currency,
    roles: book.roles,
    ownerId: book.ownerId,
    categories: book.categories,
    purposeId: book.purposeId,
    purposeConfig: book.purposeConfig,
    isMember: true,
  });
}

export function writeBookSnapshots(books: any[], uid = auth.currentUser?.uid) {
  for (const book of books || []) writeBookSnapshot(book, uid);
}

export function peekBookShell(id?: string, uid = auth.currentUser?.uid) {
  const bookId = String(id || '').trim();
  const user = String(uid || '');
  if (!bookId || !user) return null;
  const snap = readUserLocalJson<Record<string, unknown>>(user, `book_snap_${bookId}`);
  if (!isHydratedBook(snap)) return null;
  return { ...snap, _fromCache: true };
}

export function writeDashBooks(books: unknown[], uid = auth.currentUser?.uid) {
  const user = String(uid || '');
  if (!user) return;
  writeUserLocalJson(user, 'dash_books', { at: Date.now(), books: (books || []).slice(0, 80) });
}

export function readDashBooks<T = Record<string, unknown>>(uid = auth.currentUser?.uid): T[] {
  const user = String(uid || '');
  if (!user) return [];
  const snap = readUserLocalJson<{ books?: T[] }>(user, 'dash_books');
  return Array.isArray(snap?.books) ? snap.books : [];
}

function leanExpenseRow(row: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row || {})) {
    if (value == null) continue;
    if (key === 'imageDataUrl' || key === 'dataUrl' || key === 'base64' || key === 'raw') continue;
    if (typeof value === 'string') {
      if (value.startsWith('data:')) continue;
      if (key === 'receiptPath' || key === 'receiptName') {
        out[key] = value.slice(0, 500);
        continue;
      }
      if (value.length > 4000) continue;
      out[key] = value;
      continue;
    }
    if (typeof value === 'number' || typeof value === 'boolean') out[key] = value;
  }
  return out;
}

export function writeExpenseSnap(bookId: string, rows: Array<Record<string, unknown>>, uid = auth.currentUser?.uid) {
  const user = String(uid || '');
  const id = String(bookId || '').trim();
  if (!user || !id) return;
  writeUserLocalJson(user, `exp_${id}`, {
    at: Date.now(),
    rows: (rows || []).slice(0, 400).map((row) => leanExpenseRow(row)),
  });
}

export function readExpenseSnap(bookId: string, uid = auth.currentUser?.uid): Array<Record<string, unknown>> {
  const user = String(uid || '');
  const id = String(bookId || '').trim();
  if (!user || !id) return [];
  const snap = readUserLocalJson<{ rows?: Array<Record<string, unknown>> }>(user, `exp_${id}`);
  return Array.isArray(snap?.rows) ? snap.rows : [];
}

export function mergeExpenseRows<T extends { id?: unknown; idempotencyKey?: unknown; _optimistic?: unknown; offlineQueued?: unknown }>(
  server: T[],
  local: T[],
): T[] {
  const serverIds = new Set(server.map((row) => String(row?.id || '')));
  const serverKeys = new Set(server.map((row) => String(row?.idempotencyKey || '')));
  const pending = (local || []).filter((row) => {
    if (!row?._optimistic && !row?.offlineQueued) return false;
    const id = String(row.id || '');
    const key = String(row.idempotencyKey || row.id || '');
    if (!id && !key) return false;
    if (serverIds.has(id) || serverIds.has(key) || serverKeys.has(id) || serverKeys.has(key)) return false;
    return true;
  });
  return [...pending, ...server];
}

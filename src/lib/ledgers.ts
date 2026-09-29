import { apiPost } from './api';
import { auth } from './firebase';
import { clearExpensesListCache } from './expenses';

export type LedgerBook = {
  id: string;
  name: string;
  ownerId?: string;
  currency?: string;
  roles?: Record<string, { role?: string; email?: string }>;
  inboundAddress?: string;
  inboundSlug?: string;
  categories?: string[];
  isMember?: boolean;
  [key: string]: unknown;
};

const LEDGER_LIST_MS = 12_000;
let ledgerMem: { uid: string; at: number; books: LedgerBook[] } | null = null;
let ledgerInflight: { uid: string; promise: Promise<LedgerBook[]> } | null = null;

export function clearLedgerListCache() {
  ledgerMem = null;
  ledgerInflight = null;
}

export async function listLedgers() {
  const uid = String(auth.currentUser?.uid || '');
  const now = Date.now();
  if (uid && ledgerMem && ledgerMem.uid === uid && now - ledgerMem.at < LEDGER_LIST_MS) {
    return ledgerMem.books;
  }
  if (uid && ledgerInflight?.uid === uid) return ledgerInflight.promise;
  const promise = (async () => {
    const payload = await apiPost<{ books?: LedgerBook[] }>('/api/ledgers', { op: 'list' });
    const books = Array.isArray(payload.books) ? payload.books : [];
    const still = String(auth.currentUser?.uid || '');
    if (uid && still === uid) ledgerMem = { uid, at: Date.now(), books };
    return books;
  })();
  if (uid) ledgerInflight = { uid, promise };
  try {
    return await promise;
  } finally {
    if (ledgerInflight?.promise === promise) ledgerInflight = null;
  }
}

export async function getLedger(bookId: string) {
  const payload = await apiPost<{ book: LedgerBook; isMember?: boolean }>('/api/ledgers', { op: 'get', bookId });
  return { ...payload.book, isMember: payload.isMember !== false };
}

export async function forgetLedger(bookId: string) {
  clearExpensesListCache();
  clearLedgerListCache();
  await apiPost('/api/ledgers', { op: 'forgetBook', bookId });
}

export async function createLedger(input: {
  name: string;
  currency: string;
  purposeId?: string;
  purposeLabel?: string;
  categories?: string[];
  quickActions?: string[];
  purposeConfig?: Record<string, unknown>;
}) {
  const payload = await apiPost<{ book: LedgerBook }>('/api/ledgers', { op: 'create', ...input });
  let book = payload.book;
  const needsPurpose = Boolean(input.purposeId && input.purposeId !== 'default')
    || Boolean(input.categories?.length)
    || Boolean(input.quickActions?.length)
    || Boolean(input.purposeConfig);
  if (book?.id && needsPurpose && (String(book.purposeId || 'default') === 'default' || !Array.isArray(book.categories) || !book.categories.length)) {
    try {
      book = await updateLedger(book.id, {
        purposeId: input.purposeId || 'default',
        purposeLabel: input.purposeLabel,
        categories: input.categories || [],
        quickActions: input.quickActions || [],
        purposeConfig: input.purposeConfig,
      });
    } catch {
      /* older APIs still keep the book; purpose patch is best-effort */
    }
  }
  clearExpensesListCache();
  clearLedgerListCache();
  return book;
}

export async function updateLedger(bookId: string, patch: Record<string, unknown>) {
  const payload = await apiPost<{ book: LedgerBook }>('/api/ledgers', { op: 'update', bookId, patch });
  // Book metadata (name, pin, budget, purpose…) rides along with the expenses list; drop the cached copy
  // so the next screen shows the change instead of a 60s-stale snapshot.
  clearExpensesListCache();
  clearLedgerListCache();
  return payload.book;
}

export async function removeLedgerMember(bookId: string, uidToRemove: string) {
  clearExpensesListCache();
  clearLedgerListCache();
  const payload = await apiPost<{ book: LedgerBook }>('/api/ledgers', { op: 'removeMember', bookId, uidToRemove });
  return payload.book;
}

export async function softDeleteLedger(bookId: string) {
  clearExpensesListCache();
  clearLedgerListCache();
  await apiPost('/api/ledgers', { op: 'softDelete', bookId });
}

export async function ensureLedgerMailbox(bookId: string) {
  const payload = await apiPost<{ mailbox?: { address?: string; slug?: string }; book?: LedgerBook }>('/api/ledgers', {
    op: 'ensureMailbox',
    bookId,
  });
  return payload;
}

export async function listLedgerMail(bookId: string) {
  const payload = await apiPost<{ inbound?: Record<string, unknown>[]; outbound?: Record<string, unknown>[] }>('/api/ledgers', {
    op: 'mailList',
    bookId,
  });
  return {
    inbound: Array.isArray(payload.inbound) ? payload.inbound : [],
    outbound: Array.isArray(payload.outbound) ? payload.outbound : [],
  };
}

export async function addLedgerMailEvent(bookId: string, event: Record<string, unknown>) {
  await apiPost('/api/ledgers', { op: 'mailAdd', bookId, event });
}

export async function listLedgerAudit(bookId?: string, limit = 80) {
  const payload = await apiPost<{ events?: Array<Record<string, unknown>> }>('/api/ledgers', {
    op: 'auditList',
    bookId,
    limit,
  });
  return Array.isArray(payload.events) ? payload.events : [];
}

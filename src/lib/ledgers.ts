import { apiPost } from './api';

export type LedgerBook = {
  id: string;
  name: string;
  ownerId?: string;
  currency?: string;
  roles?: Record<string, { role?: string; email?: string }>;
  inboundAddress?: string;
  inboundSlug?: string;
  categories?: string[];
  [key: string]: unknown;
};

export async function listLedgers() {
  const payload = await apiPost<{ books?: LedgerBook[] }>('/api/ledgers', { op: 'list' });
  return Array.isArray(payload.books) ? payload.books : [];
}

export async function getLedger(bookId: string) {
  const payload = await apiPost<{ book: LedgerBook }>('/api/ledgers', { op: 'get', bookId });
  return payload.book;
}

export async function createLedger(input: { name: string; currency: string }) {
  const payload = await apiPost<{ book: LedgerBook }>('/api/ledgers', { op: 'create', ...input });
  return payload.book;
}

export async function updateLedger(bookId: string, patch: Record<string, unknown>) {
  const payload = await apiPost<{ book: LedgerBook }>('/api/ledgers', { op: 'update', bookId, patch });
  return payload.book;
}

export async function removeLedgerMember(bookId: string, uidToRemove: string) {
  const payload = await apiPost<{ book: LedgerBook }>('/api/ledgers', { op: 'removeMember', bookId, uidToRemove });
  return payload.book;
}

export async function softDeleteLedger(bookId: string) {
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

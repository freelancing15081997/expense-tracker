import { apiPost } from './api';

export type Role = 'owner' | 'admin' | 'contributor' | 'viewer';
export type MoneyAccount = { id: string; name: string; kind: 'cash' | 'bank' | 'upi' | 'debit_card' | 'credit_card' | 'wallet' | 'custom'; openingBalancePaise?: number; archived?: boolean };
export type Book = {
  id: string; name: string; ownerId?: string; currency?: string; purposeId?: string; purposeLabel?: string;
  roles?: Record<string, { role?: Role; email?: string; displayName?: string }>;
  categories?: string[]; moneyAccounts?: MoneyAccount[]; monthlyBudget?: number; pinned?: boolean;
  inboundAddress?: string; totals?: { inPaise?: number; outPaise?: number; count?: number }; archived?: boolean; deleted?: boolean;
  [k: string]: unknown;
};
export type Expense = {
  id: string; bookId?: string; amount: number; currency?: string; date: string; time?: string;
  entryType?: 'in' | 'out' | 'transfer'; txType?: string; description?: string; merchant?: string; category?: string;
  paymentMethod?: string; accountId?: string; toAccountId?: string; fundSource?: string; upiRef?: string; vpa?: string;
  invoiceNumber?: string; taxAmount?: number; documentType?: string; notes?: string; adjustments?: string;
  paidByUid?: string; spenderName?: string; spenderEmail?: string; receiptPath?: string; receiptName?: string;
  attachments?: Array<{ path: string; name: string; mime?: string }>; flagged?: boolean; source?: string; captureId?: string;
  split?: unknown; createdAt?: string; updatedAt?: string; lastEditedBy?: string; deleted?: boolean;
  [k: string]: unknown;
};

export const DEFAULT_CATEGORIES = ['Meals', 'Groceries', 'Fuel', 'Travel', 'Shopping', 'Utilities', 'Housing', 'Health', 'Education', 'Insurance', 'Entertainment', 'Software Subscriptions', 'Salary', 'Business', 'Gifts', 'Uncategorized'];
export const PAYMENT_METHODS = [
  { id: 'upi', label: 'UPI' }, { id: 'card', label: 'Card' }, { id: 'cash', label: 'Cash' },
  { id: 'bank', label: 'Bank transfer' }, { id: 'wallet', label: 'Wallet' }, { id: 'other', label: 'Other' },
];
export const KIND_OPTIONS = [
  { entryType: 'out', txType: 'EXPENSE', label: 'Expense' },
  { entryType: 'in', txType: 'INCOME', label: 'Income' },
  { entryType: 'transfer', txType: 'TRANSFER', label: 'Transfer' },
  { entryType: 'in', txType: 'REFUND', label: 'Refund' },
  { entryType: 'out', txType: 'REVERSAL', label: 'Reversal' },
  { entryType: 'transfer', txType: 'CREDIT_CARD_PAYMENT', label: 'Card payment' },
  { entryType: 'transfer', txType: 'CASH_WITHDRAWAL', label: 'Cash out' },
  { entryType: 'in', txType: 'CASH_DEPOSIT', label: 'Cash in' },
] as const;
export const DOC_TYPES = [{ id: 'receipt', label: 'Receipt' }, { id: 'bill', label: 'Bill' }, { id: 'invoice', label: 'Invoice' }];
export const PURPOSES = [
  { id: 'default', label: 'Everyday', categories: DEFAULT_CATEGORIES },
  { id: 'trip', label: 'Trip', categories: ['Travel', 'Stay', 'Meals', 'Fuel', 'Tickets', 'Shopping', 'Other'] },
  { id: 'home', label: 'Home', categories: ['Rent', 'Groceries', 'Utilities', 'Maintenance', 'Help', 'Other'] },
  { id: 'business', label: 'Business', categories: ['Sales', 'Purchase', 'Salary', 'Rent', 'Travel', 'Software Subscriptions', 'Other'] },
  { id: 'event', label: 'Wedding / event', categories: ['Venue', 'Catering', 'Decor', 'Clothes', 'Gifts', 'Travel', 'Other'] },
  { id: 'vehicle', label: 'Vehicle', categories: ['Fuel', 'Service', 'Insurance', 'Toll', 'Parking', 'EMI', 'Other'] },
];

export const defaultAccounts = (): MoneyAccount[] => [
  { id: 'cash', name: 'Cash', kind: 'cash' }, { id: 'bank', name: 'Bank', kind: 'bank' }, { id: 'upi', name: 'UPI', kind: 'upi' },
];
export const accountsOf = (b?: Book | null) => (b?.moneyAccounts?.length ? b.moneyAccounts.filter((a) => !a.archived) : defaultAccounts());
export const categoriesOf = (b?: Book | null) => (b?.categories?.length ? b.categories : DEFAULT_CATEGORIES);
export const roleOf = (b: Book | null | undefined, uid: string): Role | '' =>
  !b ? '' : b.ownerId === uid ? 'owner' : ((b.roles?.[uid]?.role as Role) || '');
export const canEdit = (b: Book | null | undefined, uid: string) => ['owner', 'admin', 'contributor'].includes(roleOf(b, uid));
export const canManage = (b: Book | null | undefined, uid: string) => ['owner', 'admin'].includes(roleOf(b, uid));

// ---- Books (/api/ledgers) ----
export const listBooks = async () => ((await apiPost<{ books?: Book[] }>('/api/ledgers', { op: 'list' })).books || []).filter((b) => !b.deleted && !b.archived);
export const getBook = async (bookId: string) => (await apiPost<{ book: Book }>('/api/ledgers', { op: 'get', bookId })).book;
export const createBook = async (input: { name: string; currency: string; purposeId: string; purposeLabel: string; categories: string[] }) =>
  (await apiPost<{ book: Book }>('/api/ledgers', { op: 'create', ...input })).book;
export const updateBook = async (bookId: string, patch: Partial<Book>) => (await apiPost<{ book: Book }>('/api/ledgers', { op: 'update', bookId, patch })).book;
export const deleteBook = (bookId: string) => apiPost('/api/ledgers', { op: 'softDelete', bookId });
export const leaveBook = (bookId: string) => apiPost('/api/ledgers', { op: 'forgetBook', bookId });
export const removeMember = async (bookId: string, uidToRemove: string) => (await apiPost<{ book: Book }>('/api/ledgers', { op: 'removeMember', bookId, uidToRemove })).book;
export const setMemberRole = async (bookId: string, uid: string, role: Role) => {
  const b = await getBook(bookId);
  const roles = { ...(b.roles || {}) };
  roles[uid] = { ...(roles[uid] || {}), role };
  return updateBook(bookId, { roles });
};
export const ensureMailbox = async (bookId: string) => (await apiPost<{ mailbox?: { address?: string } }>('/api/ledgers', { op: 'ensureMailbox', bookId })).mailbox?.address || '';
export const listAudit = async (bookId?: string, limit = 100) => (await apiPost<{ events?: Array<Record<string, unknown>> }>('/api/ledgers', { op: 'auditList', bookId, limit })).events || [];
export const listMail = (bookId: string) => apiPost<{ inbound?: Array<Record<string, unknown>>; outbound?: Array<Record<string, unknown>> }>('/api/ledgers', { op: 'mailList', bookId });

// ---- Entries (/api/expenses) ----
export const listEntries = async (bookId: string) => ((await apiPost<{ expenses?: Expense[] }>('/api/expenses', { op: 'list', bookId })).expenses || []).filter((e) => !e.deleted);
export const listAllEntries = async () => apiPost<{ expenses?: Expense[]; books?: Book[] }>('/api/expenses', { op: 'listAll' });
export const createEntry = async (bookId: string, expense: Partial<Expense>, opts: { force?: boolean; idempotencyKey?: string } = {}) =>
  (await apiPost<{ expense: Expense }>('/api/expenses', { op: 'create', bookId, expense, force: !!opts.force, idempotencyKey: opts.idempotencyKey })).expense;
export const updateEntry = async (bookId: string, expenseId: string, expense: Partial<Expense>) =>
  (await apiPost<{ expense: Expense }>('/api/expenses', { op: 'update', bookId, expenseId, expense: { ...expense, id: expenseId } })).expense;
export const deleteEntry = (bookId: string, expenseId: string) => apiPost('/api/expenses', { op: 'softDelete', bookId, expenseId });
export const checkDuplicate = async (bookId: string, expense: Partial<Expense>) =>
  (await apiPost<{ matches?: Expense[] }>('/api/expenses', { op: 'checkDuplicate', bookId, expense })).matches || [];

// ---- Invites (/api/invites) ----
export const createInvite = async (bookId: string, role: Role, email?: string) =>
  apiPost<{ link?: string; code?: string; expiresAt?: string }>('/api/invites', { op: 'create', bookId, role, email });
export const acceptInvite = async (code: string) => apiPost<{ bookId?: string }>('/api/invites', { op: 'accept', code });

// ---- Notifications (/api/notifications) ----
export type AppNotification = { id: string; title: string; body?: string; at: string; read?: boolean; bookId?: string; expenseId?: string; kind?: string };
/** Server rows use {action, detail, createdAt}; map to the app shape. */
export const listNotifications = async () => {
  const rows = (await apiPost<{ notifications?: Array<Record<string, unknown>> }>('/api/notifications', { op: 'list' })).notifications || [];
  return rows.map((r): AppNotification => ({
    id: String(r.id || ''), title: String(r.title || r.action || r.bookName || 'Byjan'), body: String(r.body || r.detail || ''),
    at: String(r.at || r.createdAt || ''), read: Boolean(r.read), bookId: r.bookId ? String(r.bookId) : undefined,
    expenseId: r.expenseId ? String(r.expenseId) : undefined, kind: r.kind ? String(r.kind) : undefined,
  }));
};
export const markNotificationsRead = async (ids: string[]) => {
  if (ids.length > 3) return apiPost('/api/notifications', { op: 'markAllRead' });
  await Promise.all(ids.map((id) => apiPost('/api/notifications', { op: 'markRead', id })));
};
export const registerPushToken = (token: string, platform: string) => apiPost('/api/notifications', { op: 'registerPush', token, platform });

/** Totals in paise for a list of entries (transfers excluded). */
export function totals(rows: Expense[]) {
  let inP = 0; let outP = 0;
  for (const r of rows) {
    const p = Math.round(Number(r.amount || 0) * 100);
    if (r.entryType === 'in') inP += p; else if (r.entryType !== 'transfer') outP += p;
  }
  return { inP, outP, netP: inP - outP };
}

// Books, entries, splits, invites, members & roles.
import { api, ApiError, upload } from '../client';
import * as M from '../mocks';
import type { Balance, BookDetail, BookKind, BookSummary, Category, Entry, Invite, Person, Role, RoleConfig } from '../types';

export interface NewEntry {
  bookId: string; amount: number; flow: 'out' | 'in'; category: Category; title?: string;
  date: string; note?: string; receiptId?: string; paidBy: string;
  split: { mode: 'Equal' | 'Exact' | 'Shares'; members: string[]; parts?: Record<string, number> };
}

export const booksApi = {
  /** PLACEHOLDER: GET /v1/books */
  list: () => api<BookSummary[]>('GET', '/v1/books', { mock: M.books }),

  /** PLACEHOLDER: POST /v1/books */
  create: (b: { name: string; purpose: BookKind; monthlyBudget?: number }) =>
    api<BookSummary>('POST', '/v1/books', {
      body: b,
      mock: () => {
        if (M.books.some(x => x.name.toLowerCase() === b.name.toLowerCase())) throw new ApiError(409, 'DUPLICATE', 'You already have a book called ' + b.name);
        return { ...M.books[3], id: 'new', name: b.name, kind: b.purpose };
      },
    }),

  /** PLACEHOLDER: GET /v1/books/:id */
  get: (id: string) => api<BookDetail>('GET', `/v1/books/${id}`, { mock: () => M.bookDetailFor(id) }),

  /** PLACEHOLDER: GET /v1/books/:id/entries?filter=&q= */
  entries: (id: string) => api<Entry[]>('GET', `/v1/books/${id}/entries`, { mock: M.entries }),

  /** PLACEHOLDER: GET /v1/books/:id/balances */
  balances: (id: string) =>
    api<Balance[]>('GET', `/v1/books/${id}/balances`, {
      mock: () => Object.keys(M.people).map(k => {
        const paid = M.entries.filter(e => e.paidBy === k).reduce((a, e) => a + e.amount, 0);
        const share = M.entries.filter(e => e.splitWith.includes(k)).reduce((a, e) => a + e.amount / e.splitWith.length, 0);
        return { initials: k, name: M.people[k], paid, share, net: paid - share };
      }),
    }),

  /** PLACEHOLDER: POST /v1/books/:id/invites — email/phone invites with a role. */
  invite: (id: string, contacts: string[], role: Role) =>
    api<{ sent: number }>('POST', `/v1/books/${id}/invites`, { body: { contacts, role }, mock: { sent: contacts.length } }),

  /** PLACEHOLDER: GET /v1/books/:id/invite-link */
  inviteLink: (id: string) => api<{ url: string }>('GET', `/v1/books/${id}/invite-link`, { mock: { url: M.bookDetail.inviteLink } }),

  /** PLACEHOLDER: GET /v1/books/:id/roles — current permissions, approval limit and member count per role. */
  roles: (id: string) => api<RoleConfig[]>('GET', `/v1/books/${id}/roles`, { mock: M.roleConfigs }),

  /** PLACEHOLDER: PUT /v1/books/:id/roles/:role — permissions + approval limit. */
  updateRole: (id: string, role: Role, perms: Record<string, boolean>, approvalLimit: number | null) =>
    api<void>('PUT', `/v1/books/${id}/roles/${role}`, { body: { perms, approvalLimit }, mock: undefined as void }),
};

export const entriesApi = {
  /** PLACEHOLDER: GET /v1/entries/:id */
  get: (id: string) => api<Entry>('GET', `/v1/entries/${id}`, { mock: M.entries.find(e => e.id === id) ?? M.entries[0] }),

  /** PLACEHOLDER: POST /v1/entries */
  create: (e: NewEntry) => api<Entry>('POST', '/v1/entries', { body: e, mock: { ...M.entries[0], id: 'new', amount: e.amount, category: e.category } }),

  /** PLACEHOLDER: PATCH /v1/entries/:id */
  update: (id: string, p: Partial<NewEntry>) => api<Entry>('PATCH', `/v1/entries/${id}`, { body: p, mock: { ...M.entries[0], ...p } as Entry }),

  /** PLACEHOLDER: DELETE /v1/entries/:id */
  remove: (id: string) => api<void>('DELETE', `/v1/entries/${id}`, { mock: undefined as void }),

  /** PLACEHOLDER: POST /v1/entries/:id/restore — powers "Undo" after delete. */
  restore: (id: string) => api<void>('POST', `/v1/entries/${id}/restore`, { mock: undefined as void }),

  /** PLACEHOLDER: POST /v1/entries/:id/notes */
  addNote: (id: string, text: string) => api<{ id: string }>('POST', `/v1/entries/${id}/notes`, { body: { text }, mock: { id: 'n1' } }),

  /** PLACEHOLDER: POST /v1/entries/:id/receipt (multipart) */
  attachReceipt: (id: string, file: { uri: string; name: string; type: string }) =>
    upload<{ receiptId: string }>(`/v1/entries/${id}/receipt`, file, {}, { receiptId: 'r1' }),

  /** PLACEHOLDER: POST /v1/receipts (multipart) — upload a receipt photo before saving an entry; returns its id. */
  uploadReceipt: (file: { uri: string; name: string; type: string }) => upload<{ receiptId: string }>('/v1/receipts', file, {}, { receiptId: 'rcpt_1' }),

  /** PLACEHOLDER: GET /v1/entries/:id/share-card — server-rendered image of the entry for the share sheet. */
  shareCard: (id: string) => api<{ url: string; text: string }>('GET', `/v1/entries/${id}/share-card`, { mock: { url: 'https://byjan.app/s/e1.png', text: 'Dinner at Toit · ₹4,800 · split 5 ways on Byjan' } }),

  /** PLACEHOLDER: GET /v1/entries/suggest?amount= — "same as last time" autofill. */
  suggest: (amount: number) => api<{ title: string; category: Category } | null>('GET', '/v1/entries/suggest', { query: { amount }, mock: { title: 'Swiggy', category: 'Food' } }),
};

export const invitesApi = {
  /** PLACEHOLDER: GET /v1/invites/:code */
  get: (code: string) => api<Invite>('GET', `/v1/invites/${code}`, { mock: M.invite, mockError: new ApiError(410, 'INVITE_EXPIRED', 'This invite link has expired') }),

  /** PLACEHOLDER: GET /v1/invites/:code/summary — book name, inviter and expiry, available even after the link expires. */
  summary: (code: string) => api<{ bookName: string; invitedBy: string; expired: string }>('GET', `/v1/invites/${code}/summary`, { mock: { bookName: 'Goa Trip', invitedBy: 'Priya Sharma', expired: '2 days ago' } }),

  /** PLACEHOLDER: POST /v1/invites/:code/accept */
  accept: (code: string) => api<{ bookId: string }>('POST', `/v1/invites/${code}/accept`, { delay: 1000, mock: { bookId: 'goa' } }),

  /** PLACEHOLDER: POST /v1/invites/:code/request-new — ask the inviter for a fresh link. */
  requestNew: (code: string) => api<void>('POST', `/v1/invites/${code}/request-new`, { mock: undefined as void }),
};

export const contactsApi = {
  /** PLACEHOLDER: GET /v1/contacts — people you share books with (name, short name, UPI ID). */
  list: () => api<Person[]>('GET', '/v1/contacts', { mock: M.contacts }),
};

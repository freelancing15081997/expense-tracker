export const INBOUND_MAIL_DOMAIN = 'inbound.easypado.com';

export function inboundMailboxAddress(bookId: string) {
  return `l-${String(bookId || '').trim()}@${INBOUND_MAIL_DOMAIN}`;
}

export function inboundMailboxPath(bookId: string) {
  return `inbound_mailboxes/${String(bookId || '').trim()}`;
}

export function inboundMailboxRecord(book: {
  id: string;
  name?: string;
  currency?: string;
  ownerId?: string;
  roles?: Record<string, { role?: string; email?: string }>;
}) {
  return {
    bookId: book.id,
    name: book.name || 'Ledger',
    currency: book.currency || 'INR',
    ownerId: book.ownerId || '',
    roles: book.roles || {},
    address: inboundMailboxAddress(book.id),
    updatedAt: new Date().toISOString(),
  };
}

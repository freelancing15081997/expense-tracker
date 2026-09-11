import { ensureLedgerMailbox } from './ledgers';

export const INBOUND_MAIL_DOMAIN = 'easypado.com';

export function inboundMailboxSlug(name: string) {
  const slug = String(name || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return slug || 'ledger';
}

export function inboundMailboxAddress(slugOrName: string) {
  const slug = inboundMailboxSlug(slugOrName.includes('@') ? slugOrName.split('@')[0] : slugOrName);
  return `${slug}@${INBOUND_MAIL_DOMAIN}`;
}

export function bookInboundAddress(book?: {
  name?: string;
  inboundAddress?: string;
  inboundSlug?: string;
} | null) {
  const claimed = String(book?.inboundAddress || '').trim();
  if (claimed) return claimed;
  const slug = String(book?.inboundSlug || '').trim();
  if (slug) return inboundMailboxAddress(slug);
  return inboundMailboxAddress(book?.name || 'ledger');
}

export function inboundMailboxPath(bookId: string) {
  return `inbound_mailboxes/${String(bookId || '').trim()}`;
}

export function inboundAliasPath(slug: string) {
  return `inbound_aliases/${inboundMailboxSlug(slug)}`;
}

export function inviteAppLink(inviteId: string) {
  const origin = typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'https://www.easypado.com';
  return `${origin}/#/invite/${String(inviteId || '').trim()}`;
}

export function openInviteButtonHtml(inviteId: string, label = 'Open invitation in Byjan') {
  const href = inviteAppLink(inviteId);
  return `
    <p style="text-align:center;margin:28px 0 8px">
      <a href="${href}" style="display:inline-block;background:#0B1F3A;color:#ffffff;text-decoration:none;padding:12px 18px;font-family:Arial,Helvetica,sans-serif;font-size:13px">${label}</a>
    </p>
    <p style="margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.55;color:#64748b">This link only works for the invited email. Sign out first if another account is already open on this device.</p>
  `;
}

export function ledgerAppLink(bookId: string) {
  const origin = typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'https://www.easypado.com';
  return `${origin}/#/book/${String(bookId || '').trim()}`;
}

export function openLedgerButtonHtml(bookId: string, label = 'Open ledger in Byjan') {
  const href = ledgerAppLink(bookId);
  return `
    <p style="text-align:center;margin:28px 0 8px">
      <a href="${href}" style="display:inline-block;background:#0B1F3A;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700;font-size:14px">${label}</a>
    </p>
    <p style="text-align:center;color:#64748b;font-size:12px;margin:0">Or paste this link into your browser:<br/><a href="${href}" style="color:#0B1F3A">${href}</a></p>
  `;
}

export function inboundMailboxRecord(book: {
  id: string;
  name?: string;
  currency?: string;
  ownerId?: string;
  roles?: Record<string, { role?: string; email?: string }>;
}, slug?: string) {
  const resolved = inboundMailboxSlug(slug || book.name || 'ledger');
  return {
    bookId: book.id,
    name: book.name || 'Ledger',
    currency: book.currency || 'INR',
    ownerId: book.ownerId || '',
    roles: book.roles || {},
    slug: resolved,
    address: inboundMailboxAddress(resolved),
    updatedAt: new Date().toISOString(),
  };
}

export async function claimInboundSlug(book: { id: string; name?: string }) {
  const payload = await ensureLedgerMailbox(book.id);
  return String(payload.mailbox?.slug || inboundMailboxSlug(book.name || 'ledger'));
}

export async function syncInboundMailbox(book: {
  id: string;
  name?: string;
  currency?: string;
  ownerId?: string;
  roles?: Record<string, { role?: string; email?: string }>;
}) {
  const payload = await ensureLedgerMailbox(book.id);
  const mailbox = payload.mailbox || {};
  const slug = String(mailbox.slug || inboundMailboxSlug(book.name || 'ledger'));
  return inboundMailboxRecord({ ...book, id: book.id }, slug);
}

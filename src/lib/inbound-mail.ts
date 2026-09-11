import { db } from './firebase';
import { doc, getDoc, setDoc } from './store';

export const INBOUND_MAIL_DOMAIN = 'easypado.com';

const RESERVED_INBOUND_LOCALS = new Set([
  'support',
  'info',
  'noreply',
  'no-reply',
  'admin',
  'welcome',
  'byjanbooks',
  'hello',
  'contact',
  'mail',
  'email',
]);

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

export function inboundMailboxPath(bookId: string) {
  return `inbound_mailboxes/${String(bookId || '').trim()}`;
}

export function inboundAliasPath(slug: string) {
  return `inbound_aliases/${inboundMailboxSlug(slug)}`;
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

function shortId(bookId: string) {
  return String(bookId || '').replace(/[^a-zA-Z0-9]/g, '').slice(-6).toLowerCase() || 'book';
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
  const preferred = inboundMailboxSlug(book.name || 'ledger');
  const start = RESERVED_INBOUND_LOCALS.has(preferred) ? `${preferred}-ledger` : preferred;
  const candidates = [start];
  for (let i = 2; i <= 20; i += 1) candidates.push(`${start}-${i}`);
  candidates.push(`${start}-${shortId(book.id)}`);

  for (const slug of candidates) {
    if (RESERVED_INBOUND_LOCALS.has(slug)) continue;
    try {
      const snap = await getDoc(doc(db, 'inbound_aliases', slug));
      const owner = snap.exists() ? String(snap.data()?.bookId || '') : '';
      if (!owner || owner === book.id) return slug;
    } catch {
      return slug;
    }
  }
  return `${start}-${shortId(book.id)}`;
}

export async function syncInboundMailbox(book: {
  id: string;
  name?: string;
  currency?: string;
  ownerId?: string;
  roles?: Record<string, { role?: string; email?: string }>;
}) {
  const slug = await claimInboundSlug(book);
  const record = inboundMailboxRecord(book, slug);
  await setDoc(doc(db, 'inbound_mailboxes', book.id), record);
  await setDoc(doc(db, 'inbound_aliases', slug), {
    bookId: book.id,
    slug,
    name: record.name,
    updatedAt: record.updatedAt,
  });
  return record;
}

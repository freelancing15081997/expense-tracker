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

function escapeEmail(value: string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function wrapByjanEmailHtml(opts: {
  kicker: string;
  title: string;
  intro: string;
  rows?: Array<{ label: string; value: string }>;
  note?: string;
  extraHtml?: string;
}) {
  const rows = (opts.rows || [])
    .filter((row) => String(row.value || '').trim())
    .map((row) => `
      <tr>
        <td style="padding:11px 0;border-bottom:1px solid #edf2f7;width:32%;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;font-family:Arial,Helvetica,sans-serif">${escapeEmail(row.label)}</td>
        <td style="padding:11px 0;border-bottom:1px solid #edf2f7;font-size:14px;color:#0B1F3A;font-family:Arial,Helvetica,sans-serif">${escapeEmail(row.value)}</td>
      </tr>`).join('');
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#eef2f6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f6;padding:36px 12px">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #dbe3ea;border-radius:16px;overflow:hidden">
        <tr>
          <td style="padding:26px 32px 18px;background:#0B1F3A">
            <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#ffffff;letter-spacing:0.12em">BYJAN</p>
            <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#12B8A8">${escapeEmail(opts.kicker)}</p>
          </td>
        </tr>
        <tr>
          <td style="height:4px;background:#12B8A8;font-size:0;line-height:0">&nbsp;</td>
        </tr>
        <tr>
          <td style="padding:28px 32px 8px">
            <h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.3;color:#0B1F3A;font-weight:normal">${escapeEmail(opts.title)}</h1>
            <p style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#334155">${escapeEmail(opts.intro)}</p>
            ${rows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>` : ''}
            ${opts.note ? `<p style="margin:20px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#64748b">${escapeEmail(opts.note)}</p>` : ''}
            ${opts.extraHtml || ''}
          </td>
        </tr>
        <tr>
          <td style="padding:18px 32px 26px;border-top:1px solid #edf2f7;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.7;color:#94a3b8">
            You received this because you are a member of a Byjan ledger.<br/>
            Byjan · easypado.com · Service notice, not marketing.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
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

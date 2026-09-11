import { apiPost } from './api';
import { openLedgerButtonHtml } from './inbound-mail';

export type LedgerInvite = {
  id: string;
  bookId: string;
  bookName: string;
  role: string;
  invitedBy: string;
  email?: string;
};

export function memberEmails(roles: unknown, exceptEmail?: string): string[] {
  if (!roles || typeof roles !== 'object' || Array.isArray(roles)) return [];
  const skip = String(exceptEmail || '').trim().toLowerCase();
  const out: string[] = [];
  for (const row of Object.values(roles as Record<string, { email?: unknown }>)) {
    const email = String(row?.email || '').trim().toLowerCase();
    if (!email || (skip && email === skip) || out.includes(email)) continue;
    out.push(email);
  }
  return out;
}

export async function listLedgerInvites() {
  const payload = await apiPost<{ invites?: LedgerInvite[] }>('/api/invites', { op: 'list' });
  return Array.isArray(payload.invites) ? payload.invites : [];
}

export async function createLedgerInvite(input: {
  bookId: string;
  bookName: string;
  email: string;
  role: string;
  invitedBy: string;
}) {
  const payload = await apiPost<{ id: string }>('/api/invites', {
    op: 'create',
    bookId: input.bookId,
    bookName: input.bookName,
    email: input.email,
    role: input.role,
  });
  return payload.id;
}

export async function declineLedgerInvite(inviteId: string) {
  await apiPost('/api/invites', { op: 'decline', id: inviteId });
}

export async function acceptLedgerInvite(opts: {
  invite: LedgerInvite;
  uid: string;
  email: string;
  displayName?: string;
}): Promise<{ notifyError?: string }> {
  const payload = await apiPost<{ notifyEmails?: string[]; bookName?: string; bookId?: string }>('/api/invites', {
    op: 'accept',
    id: opts.invite.id,
  });
  const to = Array.isArray(payload.notifyEmails) ? payload.notifyEmails : [];
  if (!to.length) return {};
  try {
    const { getAccessToken } = await import('./firebase');
    const token = await getAccessToken();
    if (!token) return {};
    const who = opts.displayName || opts.email;
    const bookName = payload.bookName || opts.invite.bookName;
    const bookId = payload.bookId || opts.invite.bookId;
    const res = await fetch('/api/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: to.join(', '),
        subject: `${who} joined ${bookName} expense book`,
        message: `<p>Hello,</p><p><b>${who}</b> has accepted the invitation and joined the ledger <b>${bookName}</b>.</p>${openLedgerButtonHtml(bookId)}`,
      }),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      return { notifyError: String(errBody.error || 'Email sending failed on the server.') };
    }
  } catch (err: any) {
    return { notifyError: err?.message || 'Could not notify the team.' };
  }
  return {};
}

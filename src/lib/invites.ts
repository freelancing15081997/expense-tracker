import { db } from './firebase';
import { openLedgerButtonHtml } from './inbound-mail';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from './store';

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

export function inviteDocId(bookId: string, email: string) {
  return `${String(bookId || '').trim()}_${String(email || '').trim().toLowerCase()}`;
}

export async function createLedgerInvite(input: {
  bookId: string;
  bookName: string;
  email: string;
  role: string;
  invitedBy: string;
}) {
  const email = String(input.email || '').trim().toLowerCase();
  const id = inviteDocId(input.bookId, email);
  await setDoc(doc(db, 'invites', id), {
    email,
    bookId: input.bookId,
    bookName: input.bookName,
    role: input.role,
    invitedBy: input.invitedBy,
    status: 'pending',
  });
  return id;
}

export async function declineLedgerInvite(inviteId: string) {
  await deleteDoc(doc(db, 'invites', inviteId));
}

export async function acceptLedgerInvite(opts: {
  invite: LedgerInvite;
  uid: string;
  email: string;
  displayName?: string;
}): Promise<{ notifyError?: string }> {
  const email = String(opts.email || '').trim().toLowerCase();
  await updateDoc(doc(db, 'books', opts.invite.bookId), {
    [`roles.${opts.uid}`]: { role: opts.invite.role, email },
  });
  await deleteDoc(doc(db, 'invites', opts.invite.id));

  try {
    const bookSnap = await getDoc(doc(db, 'books', opts.invite.bookId));
    const to = memberEmails(bookSnap.exists() ? bookSnap.data()?.roles : undefined, email);
    if (!to.length) return {};
    const { getAccessToken } = await import('./firebase');
    const token = await getAccessToken();
    if (!token) return {};
    const who = opts.displayName || email;
    const res = await fetch('/api/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: to.join(', '),
        subject: `${who} joined ${opts.invite.bookName} expense book`,
        message: `<p>Hello,</p><p><b>${who}</b> has accepted the invitation and joined the ledger <b>${opts.invite.bookName}</b>.</p>${openLedgerButtonHtml(opts.invite.bookId)}`,
      }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      return { notifyError: String(payload.error || 'Email sending failed on the server.') };
    }
  } catch (err: any) {
    return { notifyError: err?.message || 'Could not notify the team.' };
  }
  return {};
}

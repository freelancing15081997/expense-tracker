import { createNotification } from './notifications';
import { apiPost } from './api';
import { memberEmails } from './invites';
import {
  bookInboundAddress,
  ledgerAppLink,
  openLedgerButtonHtml,
  wrapByjanEmailHtml,
} from './inbound-mail';

export async function notifyLedgerMembers(input: {
  roles?: Record<string, { role?: string; email?: string }> | null;
  actorUid?: string;
  bookId: string;
  bookName: string;
  action: string;
  detail: string;
  senderName?: string;
  kind?: string;
  ledgerMail?: string;
  link?: string;
}) {
  const uids = Object.keys(input.roles || {}).filter((uid) => uid && uid !== input.actorUid);
  if (!uids.length) return;
  const link = input.link || ledgerAppLink(input.bookId);
  await Promise.all(uids.map((userId) =>
    createNotification({
      userId,
      bookId: input.bookId,
      bookName: input.bookName,
      kind: input.kind || 'entry',
      action: input.action,
      detail: input.detail,
      senderName: input.senderName,
      ledgerMail: input.ledgerMail,
      link,
      skipPush: false,
    }).catch((err) => console.error('Could not notify teammate', err))
  ));
}

/** In-app + email notify (same path BookView uses for add/edit/delete). Fire-and-forget safe. */
export async function notifyTeamOfLedgerChange(input: {
  book: {
    id: string;
    name?: string;
    roles?: Record<string, { role?: string; email?: string }> | null;
    inboundAddress?: string;
  };
  actorUid?: string;
  senderName?: string;
  action: string;
  detail: string;
}) {
  const bookId = String(input.book.id || '');
  const bookName = String(input.book.name || 'Money book');
  if (!bookId) return;

  await notifyLedgerMembers({
    roles: input.book.roles,
    actorUid: input.actorUid,
    bookId,
    bookName,
    action: input.action,
    detail: input.detail,
    senderName: input.senderName,
    kind: 'entry',
    ledgerMail: bookInboundAddress(input.book),
    link: ledgerAppLink(bookId),
  });

  const emails = memberEmails(input.book.roles);
  if (!emails.length) return;

  const subject = `${input.senderName || 'Someone'} ${input.action.toLowerCase()} in ${bookName} expense book`;
  const message = wrapByjanEmailHtml({
    kicker: 'Ledger notice',
    title: 'Expense Tracker update',
    intro: `${input.senderName || 'A teammate'} updated a ledger you belong to.`,
    rows: [
      { label: 'Ledger', value: bookName },
      { label: 'Action', value: input.action },
      { label: 'Details', value: input.detail },
    ],
    note: `Send receipts to ${bookInboundAddress(input.book)} and Byjan will record them for the team.`,
    extraHtml: openLedgerButtonHtml(bookId),
  });

  const list = [...new Set(emails.map((email) => String(email || '').trim().toLowerCase()).filter((email) => email.includes('@')))];
  if (!list.length) return;
  void deliverTeamMail(bookId, input.action, subject, message, list, bookInboundAddress(input.book));
}

async function deliverTeamMail(bookId: string, action: string, subject: string, message: string, list: string[], ledgerMail: string) {
  const { addLedgerMailEvent } = await import('./ledgers');
  try {
    const sent = await apiPost<{
      success?: boolean;
      messageId?: string;
      results?: Array<{ to?: string; ok?: boolean; messageId?: string | null; error?: string }>;
    }>('/api/email/send', {
      to: list[0],
      recipients: list,
      subject,
      message,
      bookId,
      ledgerMail,
      kind: 'notice',
    });
    let rows = Array.isArray(sent?.results) && sent.results.length ? sent.results : null;
    if (!rows) {
      rows = [{ to: list[0], ok: Boolean(sent?.messageId || sent?.success), messageId: sent?.messageId || null }];
      for (const email of list.slice(1)) {
        const one = await apiPost<{ success?: boolean; messageId?: string }>('/api/email/send', {
          to: email, subject, message, bookId, ledgerMail, kind: 'notice',
        });
        rows.push({ to: email, ok: Boolean(one?.messageId || one?.success), messageId: one?.messageId || null });
      }
    }
    await Promise.all(rows.map((row) => addLedgerMailEvent(bookId, {
      direction: 'outbound',
      status: row.ok === false ? 'failed' : 'accepted',
      toEmail: String(row.to || ''),
      subject,
      action,
      detail: row.ok === false ? (row.error || 'Send failed') : 'Accepted by mail provider',
      messageId: row.messageId || null,
      via: 'godaddy-smtp',
      createdAt: new Date().toISOString(),
    }).catch(() => undefined)));
  } catch (err: any) {
    console.error('Team email failed', err);
    await Promise.all(list.map((email) => addLedgerMailEvent(bookId, {
      direction: 'outbound',
      status: 'failed',
      toEmail: email,
      subject,
      action,
      detail: err?.message || 'Send failed',
      createdAt: new Date().toISOString(),
    }).catch(() => undefined)));
  }
}

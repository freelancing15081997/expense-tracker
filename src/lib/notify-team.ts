import { createNotification } from './notifications';
import { apiUrl } from './api';
import { authHeaders } from './auth-client';
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

  await Promise.all(emails.map(async (email) => {
    try {
      await fetch(apiUrl('/api/email/send'), {
        method: 'POST',
        headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          to: email,
          subject,
          message,
          ledgerMail: bookInboundAddress(input.book),
          kind: 'notice',
        }),
      });
    } catch (err) {
      console.error('Team email failed', err);
    }
  }));
}

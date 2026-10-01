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
      skipPush: (input.kind || 'entry') === 'entry',
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

  const { addLedgerMailEvent } = await import('./ledgers');
  await Promise.all(emails.map(async (email) => {
    try {
      const sent = await apiPost<{
        success?: boolean;
        messageId?: string;
        delivered?: boolean;
        delivery?: { status?: string };
      }>('/api/email/send', {
        to: email,
        subject,
        message,
        bookId,
        ledgerMail: bookInboundAddress(input.book),
        kind: 'notice',
      });
      const deliveryStatus = String(sent?.delivery?.status || (sent?.delivered ? 'delivered' : sent?.messageId ? 'accepted' : 'unknown'));
      const honestStatus = deliveryStatus === 'delivered' ? 'sent' : deliveryStatus === 'failed' ? 'failed' : 'accepted';
      await addLedgerMailEvent(bookId, {
        direction: 'outbound',
        status: honestStatus,
        toEmail: email,
        subject,
        action: input.action,
        detail: honestStatus === 'sent'
          ? 'Delivered (confirmed by mail provider)'
          : 'Accepted by mail provider — inbox delivery not confirmed yet',
        messageId: sent?.messageId || null,
        via: 'godaddy-smtp',
        deliveryStatus,
        createdAt: new Date().toISOString(),
      }).catch(() => undefined);
    } catch (err: any) {
      console.error('Team email failed', err);
      await addLedgerMailEvent(bookId, {
        direction: 'outbound',
        status: 'failed',
        toEmail: email,
        subject,
        action: input.action,
        detail: err?.message || 'Send failed',
        createdAt: new Date().toISOString(),
      }).catch(() => undefined);
    }
  }));
}

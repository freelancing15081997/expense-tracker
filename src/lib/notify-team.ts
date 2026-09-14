import { createNotification } from './notifications';
import { ledgerAppLink } from './inbound-mail';

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

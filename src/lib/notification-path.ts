/** Hash-router path for a notification. Prefer settlement pay deep links. */
export function notificationPath(n: { id?: string; [key: string]: unknown }) {
  const bookId = String(n.bookId || '');
  const settlementId = String(n.settlementId || n.pay || '');
  const link = String(n.link || '').replace(/^\/#/, '');
  const expenseId = String(n.expenseId || n.entryId || '');
  if (String(n.kind || '') === 'invite' || n.inviteId) return '/';
  if (settlementId && bookId) return `/book/${bookId}?pay=${encodeURIComponent(settlementId)}`;
  if (link.startsWith('/')) return link;
  if (bookId && expenseId) return `/book/${bookId}?entry=${encodeURIComponent(expenseId)}`;
  if (bookId) return `/book/${bookId}`;
  return '/notifications';
}

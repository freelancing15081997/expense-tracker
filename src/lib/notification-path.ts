/** Hash-router path for a notification. Prefer settlement pay deep links. */
export function notificationPath(n: { id?: string; [key: string]: unknown }) {
  const bookId = String(n.bookId || '');
  const settlementId = String(n.settlementId || n.pay || '');
  const link = String(n.link || '').replace(/^\/#/, '');
  if (settlementId && bookId) return `/book/${bookId}?pay=${encodeURIComponent(settlementId)}`;
  if (link.startsWith('/')) return link;
  if (bookId) return `/book/${bookId}`;
  return '/notifications';
}

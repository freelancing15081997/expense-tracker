/** Email format used for account + invitations. Notifications only reach a real inbox. */
export const NOTIFY_EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

export function normalizeEmail(raw: string) {
  return String(raw || '').trim().toLowerCase();
}

export function isValidNotifyEmail(raw: string) {
  const email = normalizeEmail(raw);
  if (!email || email.length > 190) return false;
  if (!NOTIFY_EMAIL_RE.test(email)) return false;
  if (email.includes('..') || email.startsWith('.') || email.endsWith('.')) return false;
  const [local, domain] = email.split('@');
  if (!local || !domain || !domain.includes('.')) return false;
  return true;
}

export const EMAIL_NOTIFY_HINT =
  'Use a real inbox you can open. Invitations, payment alerts, and book updates are emailed there — a fake or mistyped address means you will not see those notifications.';

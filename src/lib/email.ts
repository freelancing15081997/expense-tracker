/** Email format used for account + invitations. Notifications only reach a real inbox. */
export const NOTIFY_EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

const DISPOSABLE_HINTS = new Set([
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', '10minutemail.com', 'yopmail.com',
  'trashmail.com', 'fakeinbox.com', 'temp-mail.org',
]);

export function normalizeEmail(raw: string) {
  return String(raw || '').trim().toLowerCase();
}

export function isValidNotifyEmail(raw: string) {
  const email = normalizeEmail(raw);
  if (!email || email.length > 190) return false;
  if (!NOTIFY_EMAIL_RE.test(email)) return false;
  if (email.includes('..') || email.startsWith('.') || email.endsWith('.')) return false;
  if (email.includes(' ')) return false;
  const [local, domain] = email.split('@');
  if (!local || !domain || !domain.includes('.')) return false;
  if (local.length < 1 || local.length > 64) return false;
  if (domain.startsWith('-') || domain.endsWith('-') || domain.startsWith('.') || domain.endsWith('.')) return false;
  if (!/^[a-z0-9]([a-z0-9\-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9\-]*[a-z0-9])?)+$/i.test(domain)) return false;
  const tld = domain.split('.').pop() || '';
  if (tld.length < 2) return false;
  return true;
}

/** Extra check used on register/login forms — still format-only, not inbox existence. */
export function emailValidationMessage(raw: string): string | null {
  const email = normalizeEmail(raw);
  if (!email) return 'Enter your email address.';
  if (!isValidNotifyEmail(email)) return 'Enter a valid email like you@example.com.';
  const domain = email.split('@')[1] || '';
  if (DISPOSABLE_HINTS.has(domain)) {
    return 'Use a real inbox you can open — temporary email addresses are not accepted.';
  }
  return null;
}

export const EMAIL_NOTIFY_HINT =
  'Use a real inbox you can open. Invitations, payment alerts, and book updates are emailed there — a fake or mistyped address means you will not see those notifications.';

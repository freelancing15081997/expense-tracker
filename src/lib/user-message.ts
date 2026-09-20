/** Turn raw/technical errors into short messages end users can understand. */

const TECH_MARKERS = [
  /firebase/i,
  /firestore/i,
  /auth\//i,
  /resource-exhausted/i,
  /permission-denied/i,
  /unauthenticated/i,
  /failed-precondition/i,
  /DEADLINE_EXCEEDED/i,
  /ECONNREFUSED/i,
  /ENOTFOUND/i,
  /ETIMEDOUT/i,
  /socket hang up/i,
  /nodemailer/i,
  /smtp/i,
  /postgres|neon|pg_/i,
  /sqlstate/i,
  /stack trace/i,
  /at\s+\S+\s+\(/i,
  /TypeError|ReferenceType|SyntaxError|AggregateError/i,
  /status\s*code/i,
  /HTTP\s*\d{3}/i,
  /Vercel|Cloudflare|R2_|GEMINI_/i,
  /idToken|accessToken|OAuth/i,
  /SHA-?1|DEVELOPER_ERROR|error\s*10\b/i,
  /\[object Object\]/i,
  /undefined is not/i,
  /Cannot read propert/i,
];

function rawText(err: unknown): string {
  if (err == null) return '';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message || '';
  const anyErr = err as { message?: string; error?: string; code?: string };
  return String(anyErr.message || anyErr.error || '');
}

function looksTechnical(text: string) {
  const t = text.trim();
  if (!t) return true;
  if (t.length > 180) return true;
  if (/[{}<>]|^\s*Error:|^\s*Exception/i.test(t)) return true;
  return TECH_MARKERS.some((re) => re.test(t));
}

export function toUserMessage(err: unknown, fallback = 'Something went wrong. Please try again.') {
  const code = String((err as { code?: string })?.code || '').toLowerCase();
  const status = Number((err as { status?: number })?.status || 0);
  const text = rawText(err).trim();
  const lower = text.toLowerCase();

  if (code === 'resource-exhausted' || status === 429 || /quota|rate.?limit|too many|daily.?limit|exhausted/i.test(lower)) {
    return 'This service is temporarily at its limit. Please try again in a little while.';
  }
  if (status === 401 || /unauthenticated|sign.?in required|auth\/user/i.test(lower) || code.includes('unauth')) {
    return 'Please sign in again to continue.';
  }
  if (status === 403 || /permission|forbidden|not allowed/i.test(lower)) {
    return 'You do not have permission to do that.';
  }
  if (status === 404 || /not found/i.test(lower)) {
    return 'We could not find what you were looking for.';
  }
  if (status >= 500 || /internal|server error|unavailable|timeout/i.test(lower)) {
    return 'The service is busy right now. Please try again in a moment.';
  }
  if (/network|offline|failed to fetch|load failed|internet/i.test(lower)) {
    return 'Check your internet connection and try again.';
  }
  if (/wrong-password|invalid-credential|user-not-found|invalid.?email/i.test(lower) || code.includes('wrong-password') || code.includes('invalid-credential')) {
    return 'Email or password is incorrect. If you usually use Google, tap Continue with Google — or use Forgot password to set an email password.';
  }
  if (/email-already|already.?in.?use/i.test(lower) || code.includes('email-already')) {
    return 'An account with this email already exists. Try signing in.';
  }
  if (/weak-password/i.test(lower) || code.includes('weak-password')) {
    return 'Choose a stronger password (at least 6 characters).';
  }
  if (/popup-closed|cancelled|canceled/i.test(lower)) {
    return 'Sign-in was cancelled.';
  }
  // Prefer already-friendly copy (e.g. from googleSignInError) over a generic Google fallback.
  if (text && !looksTechnical(text)) return text;
  if (/google/i.test(lower) && /sign.?in|auth/i.test(lower)) {
    return 'Google sign-in did not finish. Please try again.';
  }
  return fallback;
}

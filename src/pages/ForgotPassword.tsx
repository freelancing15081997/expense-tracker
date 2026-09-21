import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { AlertCircle, Mail, ShieldCheck } from 'lucide-react';
import AuthScene from '../components/AuthScene';
import { auth } from '../lib/firebase';
import { apiPost } from '../lib/api';
import { EMAIL_NOTIFY_HINT, emailValidationMessage, maskEmail, normalizeEmail } from '../lib/email';
import { toUserMessage } from '../lib/user-message';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const loc = (location.state as { resetSent?: boolean; email?: string } | null) || {};
  const [email, setEmail] = useState(() => normalizeEmail(String(loc.email || '')));
  const [error, setError] = useState('');
  const [done, setDone] = useState(() => Boolean(loc.resetSent && loc.email));
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(() => (loc.resetSent ? 45 : 0));

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setTimeout(() => setResendIn((v) => Math.max(0, v - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [resendIn]);

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = normalizeEmail(email);
    const emailErr = emailValidationMessage(cleaned);
    if (emailErr) {
      setError(emailErr);
      return;
    }
    try {
      setBusy(true);
      setError('');
      await apiPost('/api/auth/otp', { op: 'send', purpose: 'reset', email: cleaned });
      navigate('/verify-email', { state: { email: cleaned, purpose: 'reset', otpSent: true } });
    } catch (err: any) {
      setError(toUserMessage(err, 'Could not start password reset.'));
    } finally {
      setBusy(false);
    }
  };

  const resendReset = async () => {
    const cleaned = normalizeEmail(email);
    try {
      setBusy(true);
      setError('');
      await sendPasswordResetEmail(auth, cleaned, { url: 'https://www.easypado.com/#/login', handleCodeInApp: false });
      setDone(true);
      setResendIn(45);
    } catch (err: any) {
      setError(toUserMessage(err, 'Could not send the reset link. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  if (done && email) {
    return (
      <AuthScene
        title="Reset instructions sent"
        subtitle={`Check your email at ${maskEmail(email)}`}
        switchPrompt="Remembered it?"
        switchHref="/login"
        switchLabel="Sign in"
      >
        {error ? (
          <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
            <AlertCircle className="w-4 h-4" /><span>{error}</span>
          </div>
        ) : (
          <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900 text-center flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Open the Reset Password button in that email, set a new password, then sign in. The link expires shortly.</span>
          </div>
        )}
        <button type="button" className="byjan-btn w-full h-10 mt-4" disabled={busy || resendIn > 0} onClick={() => void resendReset()}>
          {busy ? 'Sending…' : resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend reset email'}
        </button>
        <Link to="/login" className="mt-4 block text-center text-sm font-semibold text-teal-700">Back to sign in</Link>
      </AuthScene>
    );
  }

  return (
    <AuthScene
      title="Forgot password"
      subtitle="We’ll email a code, then send reset instructions automatically."
      switchPrompt="Remembered it?"
      switchHref="/login"
      switchLabel="Sign in"
    >
      {error ? (
        <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4" /><span>{error}</span>
        </div>
      ) : null}
      <form className="space-y-3" onSubmit={start}>
        <div>
          <label className="block text-sm font-medium text-slate-700 text-center">Email address</label>
          <label className="byjan-field mt-1.5">
            <Mail className="h-4 w-4 text-slate-400 shrink-0" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              inputMode="email"
            />
          </label>
        </div>
        <button type="submit" disabled={busy} className="byjan-btn w-full h-10">
          {busy ? 'Sending code…' : 'Send verification code'}
        </button>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-500 text-center">{EMAIL_NOTIFY_HINT}</p>
      </form>
    </AuthScene>
  );
}

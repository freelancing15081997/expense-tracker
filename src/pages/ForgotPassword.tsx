import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, Mail, ShieldCheck } from 'lucide-react';
import AuthScene from '../components/AuthScene';
import { apiPost } from '../lib/api';
import { EMAIL_NOTIFY_HINT, emailValidationMessage, maskEmail, normalizeEmail } from '../lib/email';
import { toUserMessage } from '../lib/user-message';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const loc = (location.state as { passwordUpdated?: boolean; email?: string } | null) || {};
  const [email, setEmail] = useState(() => normalizeEmail(String(loc.email || '')));
  const [error, setError] = useState('');
  const [done] = useState(() => Boolean(loc.passwordUpdated && loc.email));
  const [busy, setBusy] = useState(false);

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
      setError(toUserMessage(err, 'Could not send the Byjan verification email. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  if (done && email) {
    return (
      <AuthScene
        title="Password updated"
        subtitle={`You can sign in with ${maskEmail(email)}`}
        switchPrompt="Ready?"
        switchHref="/login"
        switchLabel="Sign in"
      >
        <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900 text-center flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Your new password is saved. Sign in with it now.</span>
        </div>
        <Link to="/login" className="byjan-btn w-full h-10 mt-4 inline-flex items-center justify-center">Sign in</Link>
      </AuthScene>
    );
  }

  return (
    <AuthScene
      title="Forgot password"
      subtitle="Byjan will email a verification code from byjanbooks@easypado.com."
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

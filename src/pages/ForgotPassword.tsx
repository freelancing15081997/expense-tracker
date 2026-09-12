import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, AlertCircle, CheckCircle2 } from 'lucide-react';
import AuthScene from '../components/AuthScene';
import { authErrorMessage, requestPasswordReset } from '../lib/account-security';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setBusy(true);
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(authErrorMessage(err, 'Could not send reset email'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScene
      title="Reset your password"
      subtitle="We will email you a secure link to choose a new password."
      switchPrompt="Remembered it?"
      switchHref="/login"
      switchLabel="Back to sign in"
    >
      {error && (
        <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {sent ? (
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-start gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              If an account exists for <strong>{email.trim()}</strong>, a reset link is on its way.
              Check spam if you do not see it in a minute.
            </span>
          </div>
          <Link to="/login" className="byjan-btn w-full h-10 inline-flex items-center justify-center">
            Return to sign in
          </Link>
        </div>
      ) : (
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-slate-700">Email address</label>
            <label className="byjan-field mt-1.5">
              <Mail className="h-4 w-4 text-slate-400 shrink-0" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </label>
          </div>
          <button type="submit" disabled={busy} className="byjan-btn w-full h-10">
            {busy && <span className="app-loader-ring app-loader-ring-sm" />}
            {busy ? 'Sending link' : 'Send reset link'}
          </button>
        </form>
      )}
    </AuthScene>
  );
}

import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import AuthScene from '../components/AuthScene';
import {
  authErrorMessage,
  completePasswordReset,
  readActionParams,
  verifyResetCode,
} from '../lib/account-security';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [{ oobCode }] = useState(() => readActionParams());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!oobCode) {
        setError('This reset link is missing a code. Request a new password reset email.');
        return;
      }
      try {
        const verifiedEmail = await verifyResetCode(oobCode);
        if (!cancelled) {
          setEmail(verifiedEmail);
          setReady(true);
        }
      } catch (err) {
        if (!cancelled) setError(authErrorMessage(err, 'This reset link is invalid or expired.'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [oobCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Use at least 6 characters.');
      return;
    }
    try {
      setError('');
      setBusy(true);
      await completePasswordReset(oobCode, password);
      setDone(true);
      window.setTimeout(() => navigate('/login', { replace: true }), 1600);
    } catch (err) {
      setError(authErrorMessage(err, 'Could not update password'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScene
      title="Choose a new password"
      subtitle={email ? `Updating password for ${email}` : 'Open a valid reset link from your email.'}
      switchPrompt="Back to"
      switchHref="/login"
      switchLabel="sign in"
    >
      {error && (
        <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {done ? (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Password updated. Taking you to sign in…
        </div>
      ) : ready ? (
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-slate-700">New password</label>
            <label className="byjan-field mt-1.5">
              <Lock className="h-4 w-4 text-slate-400 shrink-0" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete="new-password"
              />
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Confirm password</label>
            <label className="byjan-field mt-1.5">
              <Lock className="h-4 w-4 text-slate-400 shrink-0" />
              <input
                type="password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat password"
                autoComplete="new-password"
              />
            </label>
          </div>
          <button type="submit" disabled={busy} className="byjan-btn w-full h-10">
            {busy && <span className="app-loader-ring app-loader-ring-sm" />}
            {busy ? 'Saving password' : 'Update password'}
          </button>
        </form>
      ) : !error ? (
        <p className="text-sm text-slate-500">Checking reset link…</p>
      ) : (
        <Link to="/forgot-password" className="byjan-btn w-full h-10 inline-flex items-center justify-center">
          Request a new link
        </Link>
      )}
    </AuthScene>
  );
}

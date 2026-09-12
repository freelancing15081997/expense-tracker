import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { MultiFactorResolver } from 'firebase/auth';
import { signInWithEmailAndPassword, signInWithGoogle, auth } from '../lib/firebase';
import { Mail, Lock, AlertCircle, ShieldCheck } from 'lucide-react';
import AuthScene from '../components/AuthScene';
import { consumeReturnTo } from '../lib/return-to';
import {
  authErrorMessage,
  completeTotpSignIn,
  isMultiFactorError,
  needsEmailActivation,
  resolverFromError,
} from '../lib/account-security';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaResolver, setMfaResolver] = useState<MultiFactorResolver | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'email' | 'google' | 'mfa' | ''>('');
  const navigate = useNavigate();
  const loading = Boolean(busy);

  const afterSignIn = () => {
    const user = auth.currentUser;
    if (user && needsEmailActivation(user)) {
      navigate('/activate', { replace: true });
      return;
    }
    navigate(consumeReturnTo());
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setBusy('email');
      await signInWithEmailAndPassword(auth, email, password);
      afterSignIn();
    } catch (err: unknown) {
      if (isMultiFactorError(err)) {
        setMfaResolver(resolverFromError(err));
        setError('');
      } else {
        setError(authErrorMessage(err, 'Failed to sign in'));
      }
    } finally {
      setBusy('');
    }
  };

  const handleMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaResolver) return;
    try {
      setError('');
      setBusy('mfa');
      await completeTotpSignIn(mfaResolver, mfaCode);
      setMfaResolver(null);
      setMfaCode('');
      afterSignIn();
    } catch (err: unknown) {
      setError(authErrorMessage(err, 'Invalid authenticator code'));
    } finally {
      setBusy('');
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setError('');
      setBusy('google');
      const result = await signInWithGoogle();
      if (result) afterSignIn();
    } catch (err: unknown) {
      if (isMultiFactorError(err)) {
        setMfaResolver(resolverFromError(err));
        setError('');
      } else {
        setError(authErrorMessage(err, 'Failed to sign in with Google'));
      }
    } finally {
      setBusy('');
    }
  };

  return (
    <AuthScene
      title="Sign in to Byjan"
      subtitle="Continue with Google or your email."
      switchPrompt="New here?"
      switchHref="/register"
      switchLabel="Create an account"
    >
      {error && (
        <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {mfaResolver ? (
        <form className="space-y-3" onSubmit={handleMfa}>
          <div className="rounded-xl border border-teal-100 bg-teal-50/70 px-4 py-3 text-sm text-teal-900 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Enter the 6-digit code from your authenticator app to finish signing in.</span>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Authenticator code</label>
            <label className="byjan-field mt-1.5">
              <Lock className="h-4 w-4 text-slate-400 shrink-0" />
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                required
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                placeholder="123456"
                autoComplete="one-time-code"
              />
            </label>
          </div>
          <button type="submit" disabled={loading} className="byjan-btn w-full h-10">
            {busy === 'mfa' && <span className="app-loader-ring app-loader-ring-sm" />}
            {busy === 'mfa' ? 'Verifying' : 'Verify and continue'}
          </button>
          <button
            type="button"
            className="w-full text-sm font-medium text-slate-500 hover:text-slate-700 py-1"
            onClick={() => {
              setMfaResolver(null);
              setMfaCode('');
            }}
          >
            Back to sign in
          </button>
        </form>
      ) : (
        <>
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 h-10 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
          >
            {busy === 'google' ? <span className="app-loader-ring app-loader-ring-sm" /> : <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="w-5 h-5" />}
            {busy === 'google' ? 'Opening Google' : 'Continue with Google'}
          </button>

          <div className="my-4 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            or email
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <form className="space-y-3" onSubmit={handleEmailLogin}>
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
            <div>
              <div className="flex items-center justify-between gap-3">
                <label className="block text-sm font-medium text-slate-700">Password</label>
                <Link to="/forgot-password" className="text-xs font-semibold text-teal-700 hover:text-teal-600">
                  Forgot password?
                </Link>
              </div>
              <label className="byjan-field mt-1.5">
                <Lock className="h-4 w-4 text-slate-400 shrink-0" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  autoComplete="current-password"
                />
              </label>
            </div>
            <button type="submit" disabled={loading} className="byjan-btn w-full h-10">
              {busy === 'email' && <span className="app-loader-ring app-loader-ring-sm" />}
              {busy === 'email' ? 'Signing in' : 'Sign in'}
            </button>
          </form>
        </>
      )}
    </AuthScene>
  );
}

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, signInWithGoogle, auth } from '../lib/firebase';
import { Mail, Lock, AlertCircle } from 'lucide-react';
import AuthScene from '../components/AuthScene';
import { consumeReturnTo } from '../lib/return-to';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'email' | 'google' | ''>('');
  const navigate = useNavigate();
  const loading = Boolean(busy);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setBusy('email');
      await createUserWithEmailAndPassword(auth, email, password);
      navigate(consumeReturnTo());
    } catch (err: any) {
      setError(err.message || 'Failed to create an account');
    } finally {
      setBusy('');
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setError('');
      setBusy('google');
      const result = await signInWithGoogle();
      if (result) navigate(consumeReturnTo());
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google');
    } finally {
      setBusy('');
    }
  };

  return (
    <AuthScene
      title="Create your Byjan account"
      subtitle="One workspace for books and expenses."
      switchPrompt="Already have an account?"
      switchHref="/login"
      switchLabel="Sign in"
    >
      {error && (
        <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

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

      <form className="space-y-3" onSubmit={handleRegister}>
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
          <label className="block text-sm font-medium text-slate-700">Password</label>
          <label className="byjan-field mt-1.5">
            <Lock className="h-4 w-4 text-slate-400 shrink-0" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              autoComplete="new-password"
              minLength={6}
            />
          </label>
        </div>
        <button type="submit" disabled={loading} className="byjan-btn w-full h-10">
          {busy === 'email' && <span className="app-loader-ring app-loader-ring-sm" />}
          {busy === 'email' ? 'Creating account' : 'Create account'}
        </button>
      </form>
    </AuthScene>
  );
}

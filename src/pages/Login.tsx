import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { signInWithEmailAndPassword, signInWithGoogle, auth, handoffGoogleToNativeApp } from '../lib/firebase';
import { Mail, Lock, AlertCircle } from 'lucide-react';
import AuthScene from '../components/AuthScene';
import OnboardingSlides from '../components/OnboardingSlides';
import { consumeReturnTo } from '../lib/return-to';
import { consumeAuthNotice } from '../lib/support';
import { EMAIL_NOTIFY_HINT, isValidNotifyEmail, normalizeEmail } from '../lib/email';

const ONBOARD_KEY = 'byjan.onboard.v1';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'email' | 'google' | ''>('');
  const [showOnboard, setShowOnboard] = useState(() => {
    try {
      if (Capacitor.isNativePlatform()) return localStorage.getItem(ONBOARD_KEY) !== '1';
      const hash = String(window.location.hash || '');
      const q = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : window.location.search.replace(/^\?/, '');
      if (new URLSearchParams(q).get('nativeApp') === '1') return false;
      return localStorage.getItem(ONBOARD_KEY) !== '1';
    } catch { return true; }
  });
  const navigate = useNavigate();
  const loading = Boolean(busy);

  useEffect(() => {
    const notice = consumeAuthNotice();
    if (notice) setError(notice);
  }, []);

  useEffect(() => {
    // Web-only: finish Google when opened as mobile handoff page. Never on Capacitor
    // (native Google sheet only — do not load easypado.com inside the app).
    if (Capacitor.isNativePlatform()) return;
    try {
      const hash = String(window.location.hash || '');
      const q = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : window.location.search.replace(/^\?/, '');
      const params = new URLSearchParams(q);
      if (params.get('nativeApp') !== '1' || params.get('google') !== '1') return;
      const autoKey = `byjan.nativeGoogleAuto.${params.get('ts') || '1'}`;
      if (sessionStorage.getItem(autoKey) === '1') return;
      sessionStorage.setItem(autoKey, '1');
      void (async () => {
        try {
          setBusy('google');
          const result = await signInWithGoogle();
          if (await handoffGoogleToNativeApp(result)) {
            setError('Signed in — returning to the Byjan app…');
            return;
          }
          if (result) navigate(consumeReturnTo());
        } catch (err: any) {
          try { sessionStorage.removeItem(autoKey); } catch { /* ignore */ }
          setError(err?.message || 'Failed to sign in with Google');
        } finally {
          setBusy('');
        }
      })();
    } catch { /* ignore */ }
  }, [navigate]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = normalizeEmail(email);
    if (!isValidNotifyEmail(cleaned)) {
      setError(EMAIL_NOTIFY_HINT);
      return;
    }
    try {
      setError('');
      setBusy('email');
      await signInWithEmailAndPassword(auth, cleaned, password);
      navigate(consumeReturnTo());
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setBusy('');
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setError('');
      setBusy('google');
      const result = await signInWithGoogle();
      // On Android/iOS stay in-app; only bounce from website → installed app.
      if (!Capacitor.isNativePlatform() && (await handoffGoogleToNativeApp(result))) {
        setError('Signed in — returning to the Byjan app…');
        return;
      }
      if (result) navigate(consumeReturnTo());
    } catch (err: any) {
      try { sessionStorage.removeItem('byjan.nativeGoogleAuto'); } catch { /* ignore */ }
      setError(err.message || 'Failed to sign in with Google');
    } finally {
      setBusy('');
    }
  };

  const finishOnboard = () => {
    try { localStorage.setItem(ONBOARD_KEY, '1'); } catch { /* ignore */ }
    setShowOnboard(false);
  };

  if (showOnboard) {
    return <OnboardingSlides onDone={finishOnboard} />;
  }

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

      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={busy === 'google'}
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
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500 text-center">{EMAIL_NOTIFY_HINT}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 text-center">Password</label>
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
    </AuthScene>
  );
}

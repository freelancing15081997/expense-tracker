import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import AuthScene from '../components/AuthScene';
import { apiPost } from '../lib/api';
import { createUserWithEmailAndPassword, auth } from '../lib/firebase';
import { normalizeEmail } from '../lib/email';
import { checkNewPassword } from '../lib/password';
import { consumeReturnTo } from '../lib/return-to';
import { toUserMessage } from '../lib/user-message';
import { upsertMe } from '../lib/me';

type LocState = {
  email?: string;
  password?: string;
  purpose?: 'register' | 'reset';
  otpSent?: boolean;
};

const PENDING_KEY = 'byjan.pendingRegister';

export default function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state || {}) as LocState;
  const [email, setEmail] = useState(() => normalizeEmail(state.email || ''));
  const [password, setPassword] = useState(() => String(state.password || ''));
  const purpose = (state.purpose === 'reset' ? 'reset' : 'register') as 'register' | 'reset';
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [info, setInfo] = useState(() => (state.otpSent && state.email ? `We sent a 6-digit code to ${normalizeEmail(state.email)}.` : ''));
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(() => (state.otpSent ? 45 : 0));
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const autoSent = useRef(false);

  useEffect(() => {
    if (email && (password || purpose === 'reset')) {
      try { sessionStorage.setItem(PENDING_KEY, JSON.stringify({ email, password, purpose })); } catch { /* ignore */ }
      return;
    }
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as LocState;
      if (parsed.email) setEmail(normalizeEmail(parsed.email));
      if (parsed.password) setPassword(String(parsed.password));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setTimeout(() => setResendIn((v) => Math.max(0, v - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [resendIn]);

  useEffect(() => {
    if (autoSent.current || state.otpSent || !email) return;
    autoSent.current = true;
    void sendCode(true);
  }, [email]);

  const code = digits.join('');

  const sendCode = async (silent = false) => {
    if (!email) {
      setError('Missing email. Start registration again.');
      return;
    }
    try {
      setBusy(true);
      setError('');
      if (!silent) setInfo('');
      await apiPost('/api/auth/otp', { op: 'send', purpose, email });
      setResendIn(45);
      setInfo(`We sent a 6-digit code to ${email}.`);
    } catch (err: any) {
      setError(toUserMessage(err, 'Could not send the code. Try again in a moment.'));
    } finally {
      setBusy(false);
    }
  };

  const onDigit = (index: number, value: string) => {
    const clean = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = clean;
    setDigits(next);
    if (clean && index < 5) inputs.current[index + 1]?.focus();
  };

  const onKeyDown = (index: number, key: string) => {
    if (key === 'Backspace' && !digits[index] && index > 0) inputs.current[index - 1]?.focus();
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    if (purpose === 'register') {
      const pwd = checkNewPassword(password);
      if (!pwd.ok) {
        setError(pwd.message || 'Start registration again with a strong password.');
        return;
      }
    }
    try {
      setBusy(true);
      setError('');
      await apiPost('/api/auth/otp', { op: 'verify', purpose, email, code });
      if (purpose === 'register') {
        await createUserWithEmailAndPassword(auth, email, password);
        try {
          await upsertMe({ email, emailVerified: true, emailVerifiedAt: new Date().toISOString() });
        } catch { /* profile upsert best-effort */ }
        try { sessionStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }
        navigate(consumeReturnTo(), { replace: true });
        return;
      }
      // reset purpose: hand off to forgot-password confirm step
      navigate('/forgot-password', { replace: true, state: { email, verified: true } });
    } catch (err: any) {
      setError(toUserMessage(err, 'Could not verify that code.'));
    } finally {
      setBusy(false);
    }
  };

  if (!email) {
    return (
      <AuthScene title="Verify your email" subtitle="Start from Create account." switchPrompt="Back to" switchHref="/register" switchLabel="registration">
        <p className="text-sm text-slate-600 text-center">No pending registration found.</p>
        <Link to="/register" className="byjan-btn w-full h-10 mt-4 inline-flex items-center justify-center">Create account</Link>
      </AuthScene>
    );
  }

  return (
    <AuthScene
      title="Enter verification code"
      subtitle={`We emailed a code to ${email}`}
      switchPrompt="Wrong email?"
      switchHref="/register"
      switchLabel="Go back"
    >
      {error ? (
        <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
      {info ? (
        <div className="mb-4 bg-teal-50 border border-teal-200 text-teal-800 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>{info}</span>
        </div>
      ) : null}

      <form className="space-y-4" onSubmit={verify}>
        <div className="flex justify-center gap-2">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputs.current[i] = el; }}
              inputMode="numeric"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              maxLength={1}
              value={d}
              onChange={(e) => onDigit(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e.key)}
              className="w-11 h-12 text-center text-lg font-bold rounded-xl border border-slate-200 bg-white text-[#0B1F3A] focus:outline-none focus:ring-2 focus:ring-teal-500/40"
              aria-label={`Digit ${i + 1}`}
            />
          ))}
        </div>
        <button type="submit" disabled={busy || code.length !== 6} className="byjan-btn w-full h-10">
          {busy ? 'Verifying…' : purpose === 'register' ? 'Verify & activate' : 'Verify code'}
        </button>
        <button
          type="button"
          disabled={busy || resendIn > 0}
          onClick={() => void sendCode(false)}
          className="w-full text-sm font-semibold text-teal-700 disabled:text-slate-400"
        >
          {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
        </button>
      </form>
    </AuthScene>
  );
}

import React, { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Mail } from 'lucide-react';
import AuthScene from '../components/AuthScene';
import { useAuth } from '../context/AuthContext';
import { logout } from '../lib/firebase';
import {
  authErrorMessage,
  needsEmailActivation,
  refreshAuthUser,
  sendActivationEmail,
} from '../lib/account-security';
import { peekReturnTo } from '../lib/return-to';

export default function ActivateAccount() {
  const { currentUser, loading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState<'send' | 'check' | ''>('');

  useEffect(() => {
    if (!currentUser || currentUser.emailVerified) return;
    void sendActivationEmail(currentUser).catch(() => undefined);
  }, [currentUser?.uid]);

  if (loading) return null;
  if (!currentUser) return <Navigate to="/login" replace />;
  if (!needsEmailActivation(currentUser)) {
    return <Navigate to={peekReturnTo()} replace />;
  }

  const resend = async () => {
    try {
      setError('');
      setInfo('');
      setBusy('send');
      await sendActivationEmail(currentUser);
      setInfo('Activation email sent. Check your inbox and spam folder.');
    } catch (err) {
      setError(authErrorMessage(err, 'Could not send activation email'));
    } finally {
      setBusy('');
    }
  };

  const checkVerified = async () => {
    try {
      setError('');
      setInfo('');
      setBusy('check');
      const user = await refreshAuthUser();
      if (user?.emailVerified) {
        setInfo('Account activated. Opening your workspace…');
        navigate(peekReturnTo(), { replace: true });
        return;
      }
      setError('Email is not verified yet. Open the link from your inbox, then try again.');
    } catch (err) {
      setError(authErrorMessage(err, 'Could not refresh verification status'));
    } finally {
      setBusy('');
    }
  };

  return (
    <AuthScene
      title="Activate your account"
      subtitle="Confirm your email to unlock Byjan. Existing accounts keep working without this step."
      switchPrompt="Wrong account?"
      switchHref="/login"
      switchLabel="Sign out and switch"
    >
      {error && (
        <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {info && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{info}</span>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 mb-4 flex items-start gap-2">
        <Mail className="w-4 h-4 mt-0.5 text-teal-700 shrink-0" />
        <span>
          We sent an activation link to <strong>{currentUser.email}</strong>. After you confirm,
          click the button below.
        </span>
      </div>

      <div className="space-y-2">
        <button type="button" disabled={Boolean(busy)} onClick={checkVerified} className="byjan-btn w-full h-10">
          {busy === 'check' && <span className="app-loader-ring app-loader-ring-sm" />}
          {busy === 'check' ? 'Checking' : 'I verified my email'}
        </button>
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={resend}
          className="w-full h-10 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
        >
          {busy === 'send' ? 'Sending…' : 'Resend activation email'}
        </button>
        <button
          type="button"
          className="w-full text-sm font-medium text-slate-500 hover:text-slate-700 py-2"
          onClick={() => void logout()}
        >
          Sign out
        </button>
      </div>
      <p className="mt-4 text-xs text-slate-400">
        Prefer Google sign-in?{' '}
        <Link to="/login" className="text-teal-700 font-semibold" onClick={() => void logout()}>
          Switch account
        </Link>
      </p>
    </AuthScene>
  );
}

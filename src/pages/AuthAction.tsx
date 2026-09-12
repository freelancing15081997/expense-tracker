import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import AuthScene from '../components/AuthScene';
import {
  applyEmailActionCode,
  authErrorMessage,
  readActionParams,
} from '../lib/account-security';

export default function AuthAction() {
  const navigate = useNavigate();
  const [{ mode, oobCode }] = useState(() => readActionParams());
  const [error, setError] = useState('');
  const [message, setMessage] = useState('Working on your request…');
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!oobCode) {
        setError('This link is missing a verification code.');
        return;
      }
      if (mode === 'resetPassword') {
        navigate(`/reset-password?oobCode=${encodeURIComponent(oobCode)}&mode=resetPassword`, { replace: true });
        return;
      }
      if (mode === 'verifyEmail' || mode === 'verifyAndChangeEmail') {
        try {
          await applyEmailActionCode(oobCode);
          if (cancelled) return;
          setOk(true);
          setMessage('Your email is verified. You can continue to Byjan.');
        } catch (err) {
          if (!cancelled) setError(authErrorMessage(err, 'Could not verify this email link'));
        }
        return;
      }
      setError(`Unsupported action: ${mode || 'unknown'}.`);
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, navigate, oobCode]);

  return (
    <AuthScene
      title="Account link"
      subtitle="Finishing the action from your email."
      switchPrompt="Go to"
      switchHref="/login"
      switchLabel="sign in"
    >
      {error && (
        <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {!error && (
        <div className={`mb-4 px-4 py-3 rounded-xl flex items-center gap-2 text-sm border ${ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
          {ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <span className="app-loader-ring app-loader-ring-sm" />}
          <span>{message}</span>
        </div>
      )}
      {ok && (
        <Link to="/activate" className="byjan-btn w-full h-10 inline-flex items-center justify-center">
          Continue
        </Link>
      )}
    </AuthScene>
  );
}

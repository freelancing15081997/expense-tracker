import React, { useState } from 'react';
import { authClient } from '../lib/auth-client';

function GoogleMark() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.6h5.1c-.2 1.2-.9 2.3-1.9 3l3.1 2.4c1.8-1.7 2.8-4.1 2.8-7 0-.7-.1-1.3-.2-1.9H12z" />
      <path fill="#34A853" d="M5.3 14.3l-.8.6-2.5 2C3.6 20.2 7.5 22.5 12 22.5c2.7 0 5-.9 6.7-2.4l-3.1-2.4c-.9.6-2 .9-3.6.9-2.7 0-5-1.8-5.8-4.3z" />
      <path fill="#4A90E2" d="M2 7.1C1.3 8.5 1 10 1 11.6c0 1.6.3 3.1 1 4.5l3.3-2.6C5 12.6 4.8 12.1 4.8 11.6c0-.5.2-1 .5-1.5z" />
      <path fill="#FBBC05" d="M12 4.8c1.5 0 2.8.5 3.9 1.5l2.9-2.9C16.9 1.7 14.6.8 12 .8 7.5.8 3.6 3.1 2 7.1l3.3 2.6C6.1 7.2 8.4 4.8 12 4.8z" />
    </svg>
  );
}

export default function SocialSignIn({ disabled }: { disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const signInWithGoogle = async () => {
    try {
      setError('');
      setBusy(true);
      const callbackURL = `${window.location.origin}${window.location.pathname || '/'}#/`;
      const result = await authClient.signIn.social({
        provider: 'google',
        callbackURL,
      });
      if ((result as any)?.error) {
        throw new Error((result as any).error.message || 'Google sign-in failed');
      }
    } catch (err: any) {
      setError(err?.message || 'Google sign-in failed. Enable Google in Neon Auth and add this site as a trusted origin.');
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">{error}</p>
      )}
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => void signInWithGoogle()}
        className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-60"
      >
        <GoogleMark />
        {busy ? 'Redirecting…' : 'Continue with Google'}
      </button>
    </div>
  );
}

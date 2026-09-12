import React, { useMemo, useState } from 'react';
import type { TotpSecret } from 'firebase/auth';
import { KeyRound, ShieldCheck, Smartphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  authErrorMessage,
  changePassword,
  finishTotpEnrollment,
  hasPasswordProvider,
  hasTotpMfa,
  listEnrolledFactors,
  refreshAuthUser,
  sendActivationEmail,
  startTotpEnrollment,
  unenrollTotpFactor,
} from '../lib/account-security';

function qrImageUrl(otpauthUrl: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(otpauthUrl)}`;
}

export default function AccountSecurityPanel() {
  const { currentUser } = useAuth();
  const { addToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [mfaBusy, setMfaBusy] = useState(false);
  const [activationBusy, setActivationBusy] = useState(false);
  const [totpSecret, setTotpSecret] = useState<TotpSecret | null>(null);
  const [totpQr, setTotpQr] = useState('');
  const [totpKey, setTotpKey] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [tick, setTick] = useState(0);

  const passwordUser = hasPasswordProvider(currentUser);
  const mfaEnabled = useMemo(() => hasTotpMfa(currentUser), [currentUser, tick]);
  const factors = useMemo(() => listEnrolledFactors(currentUser), [currentUser, tick]);

  const bump = async () => {
    await refreshAuthUser();
    setTick((n) => n + 1);
  };

  const onChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nextPassword !== confirmPassword) {
      addToast('New passwords do not match', 'error');
      return;
    }
    try {
      setPasswordBusy(true);
      await changePassword(currentPassword, nextPassword);
      setCurrentPassword('');
      setNextPassword('');
      setConfirmPassword('');
      addToast('Password updated', 'success');
    } catch (err) {
      addToast(authErrorMessage(err, 'Could not change password'), 'error');
    } finally {
      setPasswordBusy(false);
    }
  };

  const beginMfa = async () => {
    try {
      setMfaBusy(true);
      const started = await startTotpEnrollment(currentUser?.email || undefined);
      setTotpSecret(started.secret);
      setTotpQr(started.qrUrl);
      setTotpKey(started.secretKey);
      setTotpCode('');
    } catch (err) {
      addToast(authErrorMessage(err, 'Could not start MFA enrollment'), 'error');
    } finally {
      setMfaBusy(false);
    }
  };

  const confirmMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpSecret) return;
    try {
      setMfaBusy(true);
      await finishTotpEnrollment(totpSecret, totpCode);
      setTotpSecret(null);
      setTotpQr('');
      setTotpKey('');
      setTotpCode('');
      await bump();
      addToast('Authenticator MFA enabled', 'success');
    } catch (err) {
      addToast(authErrorMessage(err, 'Could not enable MFA'), 'error');
    } finally {
      setMfaBusy(false);
    }
  };

  const disableMfa = async () => {
    try {
      setMfaBusy(true);
      await unenrollTotpFactor(factors[0]?.uid);
      await bump();
      addToast('Authenticator MFA removed', 'success');
    } catch (err) {
      addToast(authErrorMessage(err, 'Could not remove MFA'), 'error');
    } finally {
      setMfaBusy(false);
    }
  };

  const resendActivation = async () => {
    if (!currentUser) return;
    try {
      setActivationBusy(true);
      await sendActivationEmail(currentUser);
      addToast('Activation email sent', 'success');
    } catch (err) {
      addToast(authErrorMessage(err, 'Could not send activation email'), 'error');
    } finally {
      setActivationBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
        Idle sign-out after 30 minutes. Maximum session length is 12 hours. Firebase Auth remains the only sign-in method.
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="w-4 h-4 text-teal-700" />
          <h3 className="text-sm font-semibold text-slate-900">Email activation</h3>
        </div>
        {currentUser?.emailVerified ? (
          <p className="text-sm text-emerald-700">Email verified for {currentUser.email}.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-slate-600">
              {currentUser?.email} is not verified yet. New email/password accounts must activate before using the app.
            </p>
            <button
              type="button"
              disabled={activationBusy || !passwordUser}
              onClick={() => void resendActivation()}
              className="byjan-btn h-9 px-3 text-sm disabled:opacity-60"
            >
              {activationBusy ? 'Sending…' : 'Send activation email'}
            </button>
          </div>
        )}
      </div>

      {passwordUser ? (
        <form onSubmit={onChangePassword} className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <KeyRound className="w-4 h-4 text-teal-700" />
            <h3 className="text-sm font-semibold text-slate-900">Change password</h3>
          </div>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Current password</span>
            <input
              type="password"
              required
              className="byjan-input"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">New password</span>
              <input
                type="password"
                required
                minLength={6}
                className="byjan-input"
                value={nextPassword}
                onChange={(e) => setNextPassword(e.target.value)}
                autoComplete="new-password"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Confirm new password</span>
              <input
                type="password"
                required
                minLength={6}
                className="byjan-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </label>
          </div>
          <button type="submit" disabled={passwordBusy} className="byjan-btn h-9 px-3 text-sm">
            {passwordBusy ? 'Updating…' : 'Update password'}
          </button>
        </form>
      ) : (
        <p className="text-sm text-slate-600">
          This account signs in with Google. Password changes apply only to email/password accounts.
        </p>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-teal-700" />
          <h3 className="text-sm font-semibold text-slate-900">Authenticator MFA (TOTP)</h3>
        </div>
        <p className="text-sm text-slate-600">
          Add a one-time code from Google Authenticator, 1Password, or Authy after password sign-in.
          Requires Firebase Identity Platform TOTP MFA to be enabled on the project.
        </p>
        {mfaEnabled ? (
          <div className="space-y-2">
            <p className="text-sm text-emerald-700">
              MFA is on{factors[0]?.displayName ? ` · ${factors[0].displayName}` : ''}.
            </p>
            <button
              type="button"
              disabled={mfaBusy}
              onClick={() => void disableMfa()}
              className="h-9 px-3 rounded-xl border border-rose-200 text-rose-700 text-sm font-semibold hover:bg-rose-50 disabled:opacity-60"
            >
              {mfaBusy ? 'Removing…' : 'Remove authenticator'}
            </button>
          </div>
        ) : totpSecret ? (
          <form onSubmit={confirmMfa} className="space-y-3 rounded-xl border border-slate-200 p-4 bg-white">
            <p className="text-sm text-slate-600">Scan this QR code, then enter the 6-digit code.</p>
            {totpQr ? (
              <img src={qrImageUrl(totpQr)} alt="MFA QR code" className="w-[180px] h-[180px] rounded-lg border border-slate-200" />
            ) : null}
            <p className="text-xs text-slate-500 break-all">
              Manual key: <span className="font-mono text-slate-800">{totpKey}</span>
            </p>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Authenticator code</span>
              <input
                className="byjan-input"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                required
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                placeholder="123456"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={mfaBusy} className="byjan-btn h-9 px-3 text-sm">
                {mfaBusy ? 'Enabling…' : 'Confirm and enable'}
              </button>
              <button
                type="button"
                className="h-9 px-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700"
                onClick={() => {
                  setTotpSecret(null);
                  setTotpQr('');
                  setTotpKey('');
                  setTotpCode('');
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button type="button" disabled={mfaBusy} onClick={() => void beginMfa()} className="byjan-btn h-9 px-3 text-sm">
            {mfaBusy ? 'Preparing…' : 'Set up authenticator'}
          </button>
        )}
      </div>
    </div>
  );
}

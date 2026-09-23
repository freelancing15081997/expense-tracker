import React, { useEffect, useMemo, useState } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Fingerprint, ShieldCheck } from 'lucide-react';
import BrandLogo from './BrandLogo';
import { useAuth } from '../context/AuthContext';
import { useFeatures } from '../lib/use-features';
import { logout } from '../lib/firebase';
import {
  biometricUnlock,
  lockConfig,
  lockIsEnabledFor,
  remainingLockMs,
  verifyLockPin,
} from '../lib/app-lock';
import { isPaymentInFlight } from '../lib/payment-flight';

function shuffledDigits() {
  const n = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
  for (let i = n.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [n[i], n[j]] = [n[j], n[i]];
  }
  return n;
}

export default function AppLockGate({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const { on: hasFeature } = useFeatures();
  const uid = currentUser?.uid || '';
  const lockAllowed = hasFeature('app_lock');
  const [locked, setLocked] = useState(() => lockAllowed && lockIsEnabledFor(uid));
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [waitMs, setWaitMs] = useState(0);
  const bgAt = React.useRef(0);
  const idleAt = React.useRef(Date.now());
  const pinTry = React.useRef(0);
  const cfg = lockConfig();
  const options = cfg.options;
  const digits = useMemo(
    () => (options.shufflePad ? shuffledDigits() : ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']),
    [locked, options.shufflePad],
  );

  useEffect(() => {
    setLocked(lockAllowed && lockIsEnabledFor(uid));
    setPin('');
    setError('');
  }, [uid, lockAllowed]);

  useEffect(() => {
    if (!lockAllowed || !uid || !lockIsEnabledFor(uid)) return;
    const autoMs = Math.max(0, Number(options.autoLockMs || 0));
    const onVis = () => {
      if (document.visibilityState === 'hidden') bgAt.current = Date.now();
      if (document.visibilityState === 'visible' && bgAt.current && Date.now() - bgAt.current >= autoMs) {
        if (!isPaymentInFlight()) setLocked(true);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    let handle: { remove: () => void } | undefined;
    if (Capacitor.isNativePlatform()) {
      void App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) bgAt.current = Date.now();
        else if (bgAt.current && Date.now() - bgAt.current >= autoMs && !isPaymentInFlight()) setLocked(true);
      }).then((h) => { handle = h; });
    }
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      handle?.remove();
    };
  }, [uid, lockAllowed, options.autoLockMs]);

  useEffect(() => {
    const idleMs = Number(options.idleLockMs || 0);
    if (!lockAllowed || !uid || !lockIsEnabledFor(uid) || idleMs <= 0) return;
    const bump = () => { idleAt.current = Date.now(); };
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, bump, { passive: true }));
    const tick = window.setInterval(() => {
      if (!locked && Date.now() - idleAt.current >= idleMs) setLocked(true);
    }, 4_000);
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, bump));
      window.clearInterval(tick);
    };
  }, [uid, lockAllowed, options.idleLockMs, locked]);

  useEffect(() => {
    if (!locked || !options.bioFirst || !cfg.biometric) return;
    void unlockBio(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked, uid]);

  useEffect(() => {
    if (!locked) return;
    const tick = window.setInterval(() => setWaitMs(remainingLockMs()), 500);
    setWaitMs(remainingLockMs());
    return () => window.clearInterval(tick);
  }, [locked]);

  const unlockWithPin = async (value: string) => {
    setBusy(true);
    setError('');
    try {
      const res = await verifyLockPin(value);
      if (!res.ok) {
        setError(res.message || 'Wrong PIN');
        setPin('');
        return;
      }
      setLocked(false);
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  const unlockBio = async (silent = false) => {
    if (busy) return;
    setBusy(true);
    if (!silent) setError('');
    try {
      const res = await biometricUnlock();
      if (res.ok) {
        setLocked(false);
        setPin('');
        return;
      }
      if (!silent && !res.cancelled) setError(res.message || 'Biometric failed — use PIN');
    } finally {
      setBusy(false);
    }
  };

  const press = (d: string) => {
    if (busy || waitMs > 0) return;
    const next = (pin + d).slice(0, 8);
    setPin(next);
    if (pinTry.current) window.clearTimeout(pinTry.current);
    if (next.length >= 4) {
      pinTry.current = window.setTimeout(() => { void unlockWithPin(next); }, 420);
    }
  };

  const pad = digits.slice(0, 9);
  const zero = digits[9];

  return (
    <>
      {children}
      {locked ? (
    <div className="lock-3d">
      <div className="lock-3d-bg" aria-hidden />
      <div className="lock-3d-orb" aria-hidden />
      <div className="lock-3d-card">
        <div className="lock-3d-seal" aria-hidden>
          <BrandLogo size="sm" className="!w-12 !h-12" />
        </div>
        <p className="lock-3d-kicker">Byjan · Protected</p>
        <h1 className="lock-3d-title">Unlock</h1>
        <p className="lock-3d-copy">
          {options.hideContent ? 'Contents are hidden until you unlock.' : 'PIN is verified on this device. We never send it to the server.'}
        </p>
        <div className="lock-3d-dots" aria-hidden>
          {Array.from({ length: Math.max(4, pin.length || 4) }).slice(0, 8).map((_, i) => (
            <span key={i} className={i < pin.length ? 'is-on' : ''} />
          ))}
        </div>
        {error ? <p className="lock-3d-error">{error}</p> : null}
        {waitMs > 0 ? <p className="lock-3d-error">Locked for {Math.ceil(waitMs / 1000)}s</p> : null}
        <div className="lock-3d-pad">
          {pad.map((d) => (
            <button key={d} type="button" className="lock-3d-key" disabled={busy || waitMs > 0} onClick={() => press(d)}>
              {d}
            </button>
          ))}
          <button type="button" className="lock-3d-key is-ghost" disabled={busy} onClick={() => setPin((p) => p.slice(0, -1))}>
            ⌫
          </button>
          <button type="button" className="lock-3d-key" disabled={busy || waitMs > 0} onClick={() => press(zero)}>
            {zero}
          </button>
          <button type="button" className="lock-3d-key is-bio" disabled={busy || waitMs > 0} onClick={() => void unlockBio()} aria-label="Use fingerprint or face">
            <Fingerprint className="w-6 h-6" />
          </button>
        </div>
        <button
          type="button"
          className="lock-3d-unlock"
          disabled={busy || pin.length < 4 || waitMs > 0}
          onClick={() => void unlockWithPin(pin)}
        >
          <ShieldCheck className="w-4 h-4" />
          {busy ? 'Checking…' : 'Unlock with PIN'}
        </button>
        <button type="button" className="lock-3d-out" onClick={() => void logout()}>
          Sign out
        </button>
      </div>
    </div>
      ) : null}
    </>
  );
}

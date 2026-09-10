import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from './AuthContext';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc } from '../lib/store';
import {
  DEFAULT_APP_PREFS,
  getRuntimePrefs,
  normalizeAppPrefs,
  setRuntimePrefs,
  type AppPrefs,
} from '../lib/app-prefs';

type AppPrefsContextValue = {
  prefs: AppPrefs;
  setPref: <K extends keyof AppPrefs>(key: K, value: AppPrefs[K]) => void;
  savePrefs: (next?: AppPrefs) => Promise<void>;
  confirmAction: (message: string, kind?: 'post' | 'delete') => Promise<boolean>;
};

const AppPrefsContext = createContext<AppPrefsContextValue>({
  prefs: DEFAULT_APP_PREFS,
  setPref: () => undefined,
  savePrefs: async () => undefined,
  confirmAction: async () => true,
});

export function useAppPrefs() {
  return useContext(AppPrefsContext);
}

export const AppPrefsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, userProfile } = useAuth();
  const [prefs, setPrefs] = useState<AppPrefs>(() => getRuntimePrefs());
  const [pending, setPending] = useState<{ message: string; resolve: (ok: boolean) => void } | null>(null);

  useEffect(() => {
    setRuntimePrefs(prefs);
    document.documentElement.dataset.density = prefs.uiDensity;
  }, [prefs]);

  useEffect(() => {
    if (!currentUser) return;
    const fromProfile = userProfile && (userProfile as { appPrefs?: unknown }).appPrefs;
    if (fromProfile && typeof fromProfile === 'object') {
      const next = normalizeAppPrefs({
        ...(fromProfile as Record<string, unknown>),
        defaultCurrency: userProfile?.defaultCurrency || DEFAULT_APP_PREFS.defaultCurrency,
      });
      setPrefs(next);
      setRuntimePrefs(next);
    }
    void getDoc(doc(db, 'users', currentUser.uid)).then((snap) => {
      if (!snap.exists()) return;
      const data = snap.data() || {};
      const next = normalizeAppPrefs({
        ...((data.appPrefs && typeof data.appPrefs === 'object') ? data.appPrefs as Record<string, unknown> : {}),
        defaultCurrency: String(data.defaultCurrency || userProfile?.defaultCurrency || DEFAULT_APP_PREFS.defaultCurrency),
      });
      setPrefs(next);
      setRuntimePrefs(next);
    }).catch(() => undefined);
  }, [currentUser?.uid]);

  const savePrefs = useCallback(async (next = prefs) => {
    const normalized = normalizeAppPrefs(next);
    setPrefs(normalized);
    setRuntimePrefs(normalized);
    if (!currentUser) return;
    await setDoc(doc(db, 'users', currentUser.uid), {
      appPrefs: normalized,
      defaultCurrency: normalized.defaultCurrency,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  }, [currentUser, prefs]);

  const setPref = useCallback(<K extends keyof AppPrefs>(key: K, value: AppPrefs[K]) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      setRuntimePrefs(next);
      return next;
    });
  }, []);

  const confirmAction = useCallback((message: string, kind: 'post' | 'delete' = 'post') => {
    const needed = kind === 'delete' ? prefs.confirmDeletes : prefs.confirmPosting;
    if (!needed) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => setPending({ message, resolve }));
  }, [prefs.confirmDeletes, prefs.confirmPosting]);

  const value = useMemo(() => ({ prefs, setPref, savePrefs, confirmAction }), [prefs, setPref, savePrefs, confirmAction]);

  return (
    <AppPrefsContext.Provider value={value}>
      {children}
      {pending && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/50">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-[0_24px_60px_-24px_rgba(11,31,58,0.45)] p-5">
            <h2 className="font-display text-lg font-semibold text-[#0B1F3A]">Confirm</h2>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">{pending.message}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="byjan-btn-ghost"
                onClick={() => {
                  pending.resolve(false);
                  setPending(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="byjan-btn"
                onClick={() => {
                  pending.resolve(true);
                  setPending(null);
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </AppPrefsContext.Provider>
  );
};

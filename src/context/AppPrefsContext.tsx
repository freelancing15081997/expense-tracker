import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from './AuthContext';
import { getMe, upsertMe } from '../lib/me';
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
  const persistTimer = useRef(0);

  useEffect(() => {
    setRuntimePrefs(prefs);
    document.documentElement.dataset.density = prefs.uiDensity;
    document.documentElement.dataset.icon = prefs.iconSize;
    document.documentElement.dataset.type = prefs.fontSize;
    document.documentElement.dataset.radius = prefs.cornerRadius;
  }, [prefs]);

  useEffect(() => {
    if (!currentUser) return;
    const fromProfile = userProfile && (userProfile as { appPrefs?: unknown }).appPrefs;
    if (fromProfile && typeof fromProfile === 'object') {
      const local = getRuntimePrefs();
      const stored = fromProfile as Record<string, unknown>;
      const next = normalizeAppPrefs({
        ...local,
        ...stored,
        iconSize: stored.iconSize || local.iconSize,
        fontSize: stored.fontSize || local.fontSize,
        cornerRadius: stored.cornerRadius || local.cornerRadius,
        uiDensity: stored.uiDensity || local.uiDensity,
        defaultCurrency: userProfile?.defaultCurrency || local.defaultCurrency,
      });
      setPrefs(next);
      setRuntimePrefs(next);
    }
    void getMe().then((data) => {
      if (!data) return;
      const local = getRuntimePrefs();
      const stored = data.appPrefs && typeof data.appPrefs === 'object' ? data.appPrefs as Record<string, unknown> : {};
      const next = normalizeAppPrefs({
        ...local,
        ...stored,
        iconSize: stored.iconSize || local.iconSize,
        fontSize: stored.fontSize || local.fontSize,
        cornerRadius: stored.cornerRadius || local.cornerRadius,
        uiDensity: stored.uiDensity || local.uiDensity,
        defaultCurrency: String(data.defaultCurrency || userProfile?.defaultCurrency || local.defaultCurrency),
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
    await upsertMe({
      appPrefs: normalized,
      defaultCurrency: normalized.defaultCurrency,
      updatedAt: new Date().toISOString(),
    });
  }, [currentUser, prefs]);

  const setPref = useCallback(<K extends keyof AppPrefs>(key: K, value: AppPrefs[K]) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      setRuntimePrefs(next);
      const live = key === 'iconSize' || key === 'fontSize' || key === 'cornerRadius' || key === 'uiDensity';
      if (currentUser && live) {
        window.clearTimeout(persistTimer.current);
        persistTimer.current = window.setTimeout(() => {
          void upsertMe({
            appPrefs: next,
            defaultCurrency: next.defaultCurrency,
            updatedAt: new Date().toISOString(),
          }).catch(() => undefined);
        }, 350);
      }
      return next;
    });
  }, [currentUser]);

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

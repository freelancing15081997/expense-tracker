import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from './AuthContext';
import { getMe, saveOrgUiDefaults, upsertMe } from '../lib/me';
import {
  DEFAULT_APP_PREFS,
  applyOrgChrome,
  chromePatch,
  getRuntimePrefs,
  normalizeAppPrefs,
  normalizeOrgChrome,
  setRuntimePrefs,
  type AppPrefs,
  type OrgUiChrome,
} from '../lib/app-prefs';

type AppPrefsContextValue = {
  prefs: AppPrefs;
  orgChrome: OrgUiChrome | null;
  setPref: <K extends keyof AppPrefs>(key: K, value: AppPrefs[K]) => void;
  savePrefs: (next?: AppPrefs) => Promise<void>;
  saveOrgDefaults: (next?: AppPrefs) => Promise<void>;
  resetToOrgDefaults: () => void;
  confirmAction: (message: string, kind?: 'post' | 'delete') => Promise<boolean>;
};

const AppPrefsContext = createContext<AppPrefsContextValue>({
  prefs: DEFAULT_APP_PREFS,
  orgChrome: null,
  setPref: () => undefined,
  savePrefs: async () => undefined,
  saveOrgDefaults: async () => undefined,
  resetToOrgDefaults: () => undefined,
  confirmAction: async () => true,
});

export function useAppPrefs() {
  return useContext(AppPrefsContext);
}

function mergeFromRemote(stored: Record<string, unknown>, org: OrgUiChrome | null, currency?: string) {
  const local = getRuntimePrefs();
  const personal = normalizeAppPrefs({
    ...local,
    ...stored,
    defaultCurrency: currency || stored.defaultCurrency || local.defaultCurrency,
  });
  return applyOrgChrome(personal, org);
}

export const AppPrefsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, userProfile } = useAuth();
  const [prefs, setPrefs] = useState<AppPrefs>(() => getRuntimePrefs());
  const [orgChrome, setOrgChrome] = useState<OrgUiChrome | null>(null);
  const [pending, setPending] = useState<{ message: string; resolve: (ok: boolean) => void } | null>(null);

  useEffect(() => {
    setRuntimePrefs(prefs);
  }, [prefs]);

  useEffect(() => {
    if (!currentUser) return;
    const fromProfile = userProfile && (userProfile as { appPrefs?: unknown }).appPrefs;
    if (fromProfile && typeof fromProfile === 'object') {
      const next = mergeFromRemote(fromProfile as Record<string, unknown>, orgChrome, userProfile?.defaultCurrency);
      setPrefs(next);
      setRuntimePrefs(next);
    }
    void getMe().then((data) => {
      if (!data) return;
      const org = normalizeOrgChrome((data as { orgUiDefaults?: unknown }).orgUiDefaults);
      setOrgChrome(org);
      const stored = data.appPrefs && typeof data.appPrefs === 'object' ? data.appPrefs as Record<string, unknown> : {};
      const next = mergeFromRemote(stored, org, String(data.defaultCurrency || userProfile?.defaultCurrency || ''));
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

  const saveOrgDefaults = useCallback(async (next = prefs) => {
    const patch = chromePatch(normalizeAppPrefs(next));
    const saved = await saveOrgUiDefaults(patch);
    const org = normalizeOrgChrome(saved);
    setOrgChrome(org);
  }, [prefs]);

  const resetToOrgDefaults = useCallback(() => {
    setPrefs((prev) => {
      const next = applyOrgChrome({ ...prev, uiOverride: false }, orgChrome);
      setRuntimePrefs(next);
      return next;
    });
  }, [orgChrome]);

  const setPref = useCallback(<K extends keyof AppPrefs>(key: K, value: AppPrefs[K]) => {
    setPrefs((prev) => {
      const chromeKeys: Array<keyof AppPrefs> = ['iconPx', 'typeScale', 'radiusPx', 'uiDensity'];
      const next = normalizeAppPrefs({
        ...prev,
        [key]: value,
        uiOverride: chromeKeys.includes(key) ? true : prev.uiOverride,
      });
      setRuntimePrefs(next);
      return next;
    });
  }, []);

  const confirmAction = useCallback((message: string, kind: 'post' | 'delete' = 'post') => {
    const needed = kind === 'delete' ? prefs.confirmDeletes : prefs.confirmPosting;
    if (!needed) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => setPending({ message, resolve }));
  }, [prefs.confirmDeletes, prefs.confirmPosting]);

  const value = useMemo(
    () => ({ prefs, orgChrome, setPref, savePrefs, saveOrgDefaults, resetToOrgDefaults, confirmAction }),
    [prefs, orgChrome, setPref, savePrefs, saveOrgDefaults, resetToOrgDefaults, confirmAction],
  );

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

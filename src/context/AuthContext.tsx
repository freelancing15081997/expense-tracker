import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, googleRedirectReady, logout, bindNativeGoogleAuthBridge, handoffGoogleToNativeApp } from '../lib/firebase';
import { getMe, upsertMe } from '../lib/me';
import { type FeatureMap } from '../lib/features';
import { emailIsSuperUser } from '../lib/super-users';
import { setStoreUser } from '../lib/store';
import { apiUrl } from '../lib/api';
import { authHeaders } from '../lib/auth-client';
import { startSessionGuard } from '../lib/session';
import AppLoader from '../components/AppLoader';
import { CapacitorService } from '../lib/capacitor';
import { setAuthNotice } from '../lib/support';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  defaultCurrency?: string;
  customCategories?: string[];
  createdAt?: any;
  photoURL?: string;
  appPrefs?: Record<string, unknown>;
  features?: FeatureMap;
  isSuperUser?: boolean;
  upiId?: string;
  upiDisplayName?: string;
  upiStatus?: string;
  upiConfirmedAt?: string;
  status?: string;
}

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isSuperUser: boolean;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  userProfile: null,
  loading: true,
  isSuperUser: false,
  refreshUserProfile: async () => undefined,
});

export const useAuth = () => useContext(AuthContext);

async function copyLegacyBooks() {
  const headers = await authHeaders({ 'content-type': 'application/json' });
  await fetch(apiUrl('/api/migrate'), { method: 'POST', headers }).catch(() => undefined);
}

function profileFromSnap(user: User, data: Record<string, unknown> | null | undefined): UserProfile {
  const base: UserProfile = {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || user.email?.split('@')[0] || 'User',
    defaultCurrency: 'INR',
    // Undefined until /api/me returns effective features — avoids showing wrong gates.
    features: undefined,
    isSuperUser: emailIsSuperUser(user.email),
  };
  if (!data) return base;
  const upiId = String(data.upiId || '').trim();
  const features = data.features && typeof data.features === 'object'
    ? data.features as FeatureMap
    : undefined;
  return {
    ...base,
    displayName: String(data.displayName || base.displayName),
    defaultCurrency: String(data.defaultCurrency || 'INR'),
    customCategories: Array.isArray(data.customCategories) ? data.customCategories.map(String) : [],
    createdAt: data.createdAt,
    photoURL: data.photoURL ? String(data.photoURL) : undefined,
    appPrefs: data.appPrefs && typeof data.appPrefs === 'object' ? data.appPrefs as Record<string, unknown> : undefined,
    features,
    isSuperUser: emailIsSuperUser(String(data.email || user.email || '')) || data.isSuperUser === true,
    upiId: upiId || undefined,
    upiDisplayName: String(data.upiDisplayName || '').trim() || undefined,
    upiStatus: String(data.upiStatus || '').trim() || undefined,
    upiConfirmedAt: String(data.upiConfirmedAt || '').trim() || undefined,
    status: String(data.status || '').trim() || undefined,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const lastUid = useRef('');

  const refreshUserProfile = async () => {
    const user = auth.currentUser;
    if (!user) {
      setUserProfile(null);
      return;
    }
    try {
      const profile = await getMe();
      setUserProfile(profileFromSnap(user, profile));
    } catch {
      // keep existing profile on refresh failure
    }
  };

  useEffect(() => {
    let cancelled = false;
    let unsubscribeAuth = () => {};
    let stopSession = () => {};

    // Hide native splash immediately so users don't stare at a blank blue screen.
    void CapacitorService.hideSplashScreen();
    window.setTimeout(() => {
      try { (window as any).__byjanHideBoot?.(); } catch { /* ignore */ }
    }, 120);

    const start = () => {
      if (cancelled) return;
      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        stopSession();
        const prevUid = lastUid.current;
        lastUid.current = user?.uid || '';
        if (user && prevUid && prevUid !== user.uid) {
          setUserProfile(null);
          setStoreUser('');
          void import('../lib/expenses').then((m) => m.clearExpensesListCache()).catch(() => undefined);
          void import('../lib/search-catalog').then((m) => m.clearSearchCatalog()).catch(() => undefined);
          void import('../components/ShareIntentListener').then((m) => m.clearShareCaches()).catch(() => undefined);
          void import('../lib/user-cache').then((m) => m.clearStoredUserCaches()).catch(() => undefined);
          void import('../lib/store').then((m) => m.clearStoreCache()).catch(() => undefined);
        }
        setCurrentUser(user);
        if (!user) {
          setStoreUser('');
          setUserProfile(null);
          setLoading(false);
          void CapacitorService.hideSplashScreen();
          try { (window as any).__byjanHideBoot?.(); } catch { /* ignore */ }
          void import('../lib/expenses').then((m) => m.clearExpensesListCache()).catch(() => undefined);
          void import('../lib/search-catalog').then((m) => m.clearSearchCatalog()).catch(() => undefined);
          void import('../components/ShareIntentListener').then((m) => m.clearShareCaches()).catch(() => undefined);
          void import('../lib/user-cache').then((m) => m.clearStoredUserCaches()).catch(() => undefined);
          void import('../lib/store').then((m) => m.clearStoreCache()).catch(() => undefined);
          return;
        }
        setStoreUser(user.uid);
        stopSession = startSessionGuard();
        // Unblock UI quickly — profile can finish loading without holding splash/login gate forever.
        setUserProfile((prev) => prev?.uid === user.uid ? prev : profileFromSnap(user, null));
        setLoading(false);
        void CapacitorService.hideSplashScreen();
        try { (window as any).__byjanHideBoot?.(); } catch { /* ignore */ }
        try {
          void copyLegacyBooks();
          const profile = await getMe();
          if (cancelled) return;
          const status = String(profile?.status || '').toLowerCase();
          if (status === 'deactivated' || status === 'deleted') {
            setAuthNotice(
              status === 'deleted'
                ? 'This Byjan account was deleted.'
                : 'This Byjan account is deactivated. Email byjanbooks@gmail.com if you want it turned back on.',
            );
            await logout();
            return;
          }
          if (!profile || !profile.displayName) {
            const base = profileFromSnap(user, profile);
            await upsertMe({ ...base, customCategories: profile?.customCategories || [], createdAt: new Date().toISOString() });
            setUserProfile(base);
          } else {
            setUserProfile(profileFromSnap(user, profile));
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : '';
          if (/deactivated|was deleted/i.test(message)) {
            setAuthNotice(message);
            await logout();
            return;
          }
          if (!cancelled) {
            setUserProfile(profileFromSnap(user, null));
            window.setTimeout(() => {
              if (!cancelled) void refreshUserProfile();
            }, 1200);
          }
        } finally {
          void CapacitorService.bindAccount(user.uid);
        }
      });
    };

    bindNativeGoogleAuthBridge();

    // Don't block auth on Google redirect forever — race with a short timeout.
    const redirectWait = Promise.race([
      googleRedirectReady.then(async (cred) => {
        if (cred) await handoffGoogleToNativeApp(cred);
        return cred;
      }).catch(() => undefined),
      new Promise((r) => window.setTimeout(r, 800)),
    ]);
    void redirectWait.finally(start);

    return () => {
      cancelled = true;
      stopSession();
      unsubscribeAuth();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, loading, isSuperUser: emailIsSuperUser(currentUser?.email || userProfile?.email), refreshUserProfile }}>
      {loading ? <AppLoader title="Byjan" message="Opening…" /> : children}
    </AuthContext.Provider>
  );
};

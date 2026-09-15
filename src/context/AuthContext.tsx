import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, googleRedirectReady } from '../lib/firebase';
import { getMe, upsertMe } from '../lib/me';
import { MEMBER_FEATURES, type FeatureMap } from '../lib/features';
import { emailIsSuperUser } from '../lib/super-users';
import { setStoreUser } from '../lib/store';
import { apiUrl } from '../lib/api';
import { authHeaders } from '../lib/auth-client';
import { startSessionGuard } from '../lib/session';
import AppLoader from '../components/AppLoader';
import { CapacitorService } from '../lib/capacitor';

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
    features: MEMBER_FEATURES,
    isSuperUser: emailIsSuperUser(user.email),
  };
  if (!data) return base;
  return {
    ...base,
    displayName: String(data.displayName || base.displayName),
    defaultCurrency: String(data.defaultCurrency || 'INR'),
    customCategories: Array.isArray(data.customCategories) ? data.customCategories.map(String) : [],
    createdAt: data.createdAt,
    photoURL: data.photoURL ? String(data.photoURL) : undefined,
    appPrefs: data.appPrefs && typeof data.appPrefs === 'object' ? data.appPrefs as Record<string, unknown> : undefined,
    features: data.features && typeof data.features === 'object' ? data.features as FeatureMap : MEMBER_FEATURES,
    isSuperUser: emailIsSuperUser(String(data.email || user.email || '')),
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

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
    void googleRedirectReady.finally(() => {
      if (cancelled) return;
      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        stopSession();
        setCurrentUser(user);
        if (!user) {
          setStoreUser('');
          setUserProfile(null);
          setLoading(false);
          void CapacitorService.hideSplashScreen();
          return;
        }
        setStoreUser(user.uid);
        stopSession = startSessionGuard();
        try {
          void copyLegacyBooks();
          const profile = await getMe();
          if (!profile || !profile.displayName) {
            const base = profileFromSnap(user, profile);
            await upsertMe({ ...base, customCategories: profile?.customCategories || [], createdAt: new Date().toISOString() });
            setUserProfile(base);
          } else {
            setUserProfile(profileFromSnap(user, profile));
          }
        } catch {
          setUserProfile(profileFromSnap(user, null));
        } finally {
          setLoading(false);
          void CapacitorService.hideSplashScreen();
          void CapacitorService.bindAccount(user.uid);
        }
      });
    });
    return () => {
      cancelled = true;
      stopSession();
      unsubscribeAuth();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, loading, isSuperUser: emailIsSuperUser(currentUser?.email || userProfile?.email), refreshUserProfile }}>
      {loading ? <AppLoader overlay title="Byjan" message="Checking your session." /> : children}
    </AuthContext.Provider>
  );
};

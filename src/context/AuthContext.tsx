import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, googleRedirectReady } from '../lib/firebase';
import { db } from '../lib/store';
import { doc, getDoc, setDoc, serverTimestamp, setStoreUser } from '../lib/store';
import { authHeaders } from '../lib/auth-client';
import AppLoader from '../components/AppLoader';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  defaultCurrency?: string;
  customCategories?: string[];
  createdAt?: any;
  photoURL?: string;
}

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  userProfile: null,
  loading: true,
  refreshUserProfile: async () => undefined,
});

export const useAuth = () => useContext(AuthContext);

async function copyLegacyBooks() {
  const headers = await authHeaders({ 'content-type': 'application/json' });
  await fetch('/api/migrate', { method: 'POST', headers }).catch(() => undefined);
}

function profileFromSnap(user: User, data: Record<string, unknown> | null | undefined): UserProfile {
  const base: UserProfile = {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || user.email?.split('@')[0] || 'User',
    defaultCurrency: 'INR',
  };
  if (!data) return base;
  return {
    ...base,
    displayName: String(data.displayName || base.displayName),
    defaultCurrency: String(data.defaultCurrency || 'INR'),
    customCategories: Array.isArray(data.customCategories) ? data.customCategories.map(String) : [],
    createdAt: data.createdAt,
    photoURL: data.photoURL ? String(data.photoURL) : undefined,
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
      const snap = await getDoc(doc(db, 'users', user.uid));
      setUserProfile(profileFromSnap(user, snap.exists() ? snap.data() : null));
    } catch {
      // keep existing profile on refresh failure
    }
  };

  useEffect(() => {
    let cancelled = false;
    let unsubscribeAuth = () => {};
    void googleRedirectReady.finally(() => {
      if (cancelled) return;
      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        setCurrentUser(user);
        if (!user) {
          setStoreUser('');
          setUserProfile(null);
          setLoading(false);
          return;
        }
        setStoreUser(user.uid);
        try {
          void copyLegacyBooks();
          const userRef = doc(db, 'users', user.uid);
          const snap = await getDoc(userRef);
          if (!snap.exists()) {
            const base = profileFromSnap(user, null);
            await setDoc(userRef, { ...base, customCategories: [], createdAt: serverTimestamp() });
            setUserProfile(base);
          } else {
            setUserProfile(profileFromSnap(user, snap.data()));
          }
        } catch {
          setUserProfile(profileFromSnap(user, null));
        } finally {
          setLoading(false);
        }
      });
    });
    return () => {
      cancelled = true;
      unsubscribeAuth();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, loading, refreshUserProfile }}>
      {loading ? <AppLoader title="Byjan" message="Checking your session." /> : children}
    </AuthContext.Provider>
  );
};

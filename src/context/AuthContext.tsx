import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, googleRedirectReady } from '../lib/firebase';
import { db } from '../lib/store';
import { doc, getDoc, setDoc, serverTimestamp } from '../lib/store';
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
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  userProfile: null,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

async function copyLegacyBooks() {
  const headers = await authHeaders({ 'content-type': 'application/json' });
  await fetch('/api/migrate', { method: 'POST', headers }).catch(() => undefined);
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let unsubscribeAuth = () => {};
    void googleRedirectReady.finally(() => {
      if (cancelled) return;
      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        setCurrentUser(user);
        if (!user) {
          setUserProfile(null);
          setLoading(false);
          return;
        }
        setLoading(true);
        const base: UserProfile = {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || user.email?.split('@')[0] || 'User',
          defaultCurrency: 'INR',
        };
        try {
          await copyLegacyBooks();
          const userRef = doc(db, 'users', user.uid);
          const snap = await getDoc(userRef);
          if (!snap.exists()) {
            await setDoc(userRef, { ...base, customCategories: [], createdAt: serverTimestamp() });
            setUserProfile(base);
          } else {
            const data = snap.data() || {};
            setUserProfile({
              ...base,
              displayName: String(data.displayName || base.displayName),
              defaultCurrency: String(data.defaultCurrency || 'INR'),
              customCategories: Array.isArray(data.customCategories) ? data.customCategories : [],
              createdAt: data.createdAt,
              photoURL: data.photoURL,
            });
          }
        } catch {
          setUserProfile(base);
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
    <AuthContext.Provider value={{ currentUser, userProfile, loading }}>
      {loading ? <AppLoader message="Loading your books" /> : children}
    </AuthContext.Provider>
  );
};

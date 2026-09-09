import React, { createContext, useContext, useEffect, useState } from 'react';
import { authClient } from '../lib/auth-client';
import { db } from '../lib/firebase';
import { doc, getDoc } from '../lib/store';
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

interface SessionUser {
  uid: string;
  email: string;
  displayName?: string;
}

interface AuthContextType {
  currentUser: SessionUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  userProfile: null,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

function mapNeonUser(user: any): SessionUser | null {
  if (!user) return null;
  const email = String(user.email || '');
  return {
    uid: String(user.id || user.sub || ''),
    email,
    displayName: String(user.name || email.split('@')[0] || 'User'),
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const session = authClient.useSession();
  const currentUser = mapNeonUser((session as any)?.data?.user);
  const pending = (session as any)?.isPending === true;
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileReady, setProfileReady] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      setUserProfile(null);
      setProfileReady(true);
      return;
    }
    setProfileReady(false);
    const base: UserProfile = {
      uid: currentUser.uid,
      email: currentUser.email,
      displayName: currentUser.displayName || currentUser.email.split('@')[0],
      defaultCurrency: 'INR',
    };
    setUserProfile(base);
    getDoc(doc(db, 'users', currentUser.uid))
      .then((snap) => {
        if (!snap.exists()) {
          setUserProfile(base);
          return;
        }
        const data = snap.data() || {};
        setUserProfile({
          ...base,
          displayName: String(data.displayName || base.displayName),
          defaultCurrency: String(data.defaultCurrency || 'INR'),
          customCategories: Array.isArray(data.customCategories) ? data.customCategories : [],
          createdAt: data.createdAt,
          photoURL: data.photoURL,
        });
      })
      .catch(() => setUserProfile(base))
      .finally(() => setProfileReady(true));
  }, [currentUser?.uid, currentUser?.email, currentUser?.displayName]);

  const loading = pending || (!!currentUser && !profileReady);

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, loading }}>
      {loading ? <AppLoader message="Loading" /> : children}
    </AuthContext.Provider>
  );
};

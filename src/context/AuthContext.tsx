import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import BrandLogo from '../components/BrandLogo';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  defaultCurrency?: string;
  customCategories?: string[];
  createdAt?: any;
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        unsubscribeProfile = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setUserProfile(docSnap.data() as UserProfile);
            return;
          }
          const profile: UserProfile = {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || user.email?.split('@')[0] || 'User',
            defaultCurrency: 'INR',
            customCategories: ['Office Supplies', 'Software Subscriptions', 'Travel', 'Meals', 'Legal & Professional'],
            createdAt: serverTimestamp(),
          };
          setUserProfile(profile);
          void setDoc(userRef, profile, { merge: true }).catch((err) => {
            if ((err as { code?: string })?.code === 'resource-exhausted') return;
            console.error(err);
          });
        }, (err) => {
          console.error(err);
          if (err.code === 'resource-exhausted' && unsubscribeProfile) {
            unsubscribeProfile();
            unsubscribeProfile = null;
          }
        });
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, loading }}>
      {loading ? (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#f3efe4] gap-3">
          <BrandLogo size="lg" />
          <p className="text-xs font-semibold tracking-[0.18em] text-slate-500">Trace Financials Easily</p>
        </div>
      ) : children}
    </AuthContext.Provider>
  );
};

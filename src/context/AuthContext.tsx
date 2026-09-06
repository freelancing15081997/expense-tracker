import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';

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
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        
        // Initial setup if not exists
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          const profile: UserProfile = {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || user.email?.split('@')[0] || 'User',
            defaultCurrency: 'INR',
            customCategories: ['Office Supplies', 'Software Subscriptions', 'Travel', 'Meals', 'Legal & Professional'],
            createdAt: serverTimestamp()
          };
          await setDoc(userRef, profile);
        }

        // Listen for changes
        unsubscribeProfile = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setUserProfile(docSnap.data() as UserProfile);
          }
        });
      } else {
        setUserProfile(null);
        if (unsubscribeProfile) {
          unsubscribeProfile();
        }
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
          <img src="/byjan-logo.jpg" alt="Byjan" className="w-28 h-28 rounded-xl object-contain bg-white" onError={(e) => { e.currentTarget.src = '/set-logo.jpg'; }} />
          <p className="text-xs font-semibold tracking-[0.18em] text-slate-500">Trace Financials Easily</p>
        </div>
      ) : children}
    </AuthContext.Provider>
  );
};

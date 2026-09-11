import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';

// Firebase is now ONLY used for Authentication
// All data storage is handled by Neon Postgres
const firebaseConfig = {
  apiKey: 'AIzaSyDQUXdMTTUOONPbua5cWm75Jn-7-SkRwjE',
  authDomain: 'gen-lang-client-0616065043.firebaseapp.com',
  projectId: 'gen-lang-client-0616065043',
  storageBucket: 'gen-lang-client-0616065043.firebasestorage.app',
  messagingSenderId: '450686107760',
  appId: '1:450686107760:web:ee4b53ae0ccd18c90734b5',
};

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Neon Postgres is used for all data storage
export const db = { vendor: 'neon' as const };

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const googleRedirectReady = getRedirectResult(auth).catch(() => null);

export async function signInWithGoogle() {
  try {
    if (!sessionStorage.getItem('byjan.returnTo')) sessionStorage.setItem('byjan.returnTo', '/');
  } catch { /* private mode */ }
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (err: any) {
    const code = String(err?.code || '');
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') throw err;
    await signInWithRedirect(auth, googleProvider);
    return null;
  }
}

export async function logout() {
  await signOut(auth);
}

export async function getAccessToken() {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

export {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
};

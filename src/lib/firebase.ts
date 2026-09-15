import { Capacitor } from '@capacitor/core';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  getRedirectResult,
  signInWithCredential,
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

function googleSignInError(err: unknown) {
  const anyErr = err as { code?: unknown; message?: unknown };
  const code = String(anyErr?.code || '');
  const message = String(anyErr?.message || '');
  if (/10\b|DEVELOPER_ERROR|ApiException:\s*10/i.test(`${code} ${message}`)) {
    return new Error('Google sign-in is not set up for this Android build. Add the debug SHA-1 fingerprint in Firebase and try again.');
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request' || /12501|canceled|cancelled/i.test(message)) {
    return new Error('Google sign-in was cancelled.');
  }
  return err instanceof Error ? err : new Error(message || 'Failed to sign in with Google');
}

export async function signInWithGoogle() {
  try {
    if (!sessionStorage.getItem('byjan.returnTo')) sessionStorage.setItem('byjan.returnTo', '/');
  } catch { /* private mode */ }

  if (Capacitor.isNativePlatform()) {
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
    try {
      const result = await FirebaseAuthentication.signInWithGoogle();
      const idToken = result.credential?.idToken;
      if (!idToken) throw new Error('Google sign-in did not return a token');
      return await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
    } catch (err) {
      throw googleSignInError(err);
    }
  }

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
  try {
    const { clearApiAuthCache } = await import('./api');
    clearApiAuthCache();
  } catch { /* ignore */ }
  try {
    const { clearJwtCache } = await import('./auth-client');
    clearJwtCache();
  } catch { /* ignore */ }
  try {
    const { clearExpensesListCache } = await import('./expenses');
    clearExpensesListCache();
  } catch { /* ignore */ }
  try {
    const { clearSearchCatalog } = await import('./search-catalog');
    clearSearchCatalog();
  } catch { /* ignore */ }
  try {
    const { clearShareCaches } = await import('../components/ShareIntentListener');
    clearShareCaches();
  } catch { /* ignore */ }
  try {
    const { clearStoreCache } = await import('./store');
    clearStoreCache();
  } catch { /* ignore */ }
  try {
    const { clearStoredUserCaches } = await import('./user-cache');
    clearStoredUserCaches();
  } catch { /* ignore */ }
  try {
    sessionStorage.removeItem('byjan_pending_capture');
    sessionStorage.removeItem('byjan.returnTo');
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('byjan_offline_queue') || key.startsWith('byjan.ledger.filters.') || key.startsWith('byjan.ledger.snap.'))) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    /* private mode */
  }
  if (Capacitor.isNativePlatform()) {
    try {
      const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
      await FirebaseAuthentication.signOut();
    } catch {
      /* native session may already be empty */
    }
  }
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

import { Capacitor } from '@capacitor/core';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth, GoogleAuthProvider, signInWithCredential, signInWithPopup, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification, updateProfile, signOut, onAuthStateChanged, type User,
} from 'firebase/auth';

// Firebase is used for Authentication only — all data lives in Neon behind /api.
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_SENDER_ID,
};

export const app = getApps().length ? getApp() : initializeApp(config);
export const auth = getAuth(app);

let tokenCache: { token: string; at: number } | null = null;

export async function getIdToken(): Promise<string | null> {
  const u = auth.currentUser;
  if (!u) return null;
  if (tokenCache && Date.now() - tokenCache.at < 50_000) return tokenCache.token;
  try {
    const token = await u.getIdToken();
    tokenCache = { token, at: Date.now() };
    return token;
  } catch { return null; }
}

export function watchAuth(cb: (u: User | null) => void) {
  return onAuthStateChanged(auth, (u) => { tokenCache = null; cb(u); });
}

function authError(e: unknown) {
  const code = String((e as { code?: string })?.code || '');
  const msg = String((e as Error)?.message || '');
  const map: Record<string, string> = {
    'auth/invalid-credential': 'Email or password is wrong.',
    'auth/wrong-password': 'Email or password is wrong.',
    'auth/user-not-found': 'No account with this email. Create one instead.',
    'auth/email-already-in-use': 'An account already uses this email. Sign in instead.',
    'auth/weak-password': 'Use at least 8 characters for your password.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
    'auth/network-request-failed': 'No internet connection.',
    'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
  };
  if (map[code]) return new Error(map[code]);
  if (/12501|cancel/i.test(msg)) return new Error('Google sign-in was cancelled.');
  if (/ApiException:\s*10|DEVELOPER_ERROR/i.test(msg)) return new Error('Google sign-in is not set up for this build yet. Use email for now.');
  return new Error('Could not sign in. Please try again.');
}

export async function signInEmail(email: string, password: string) {
  try { return await signInWithEmailAndPassword(auth, email.trim(), password); } catch (e) { throw authError(e); }
}

export async function registerEmail(name: string, email: string, password: string) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
    await sendEmailVerification(cred.user).catch(() => undefined);
    return cred;
  } catch (e) { throw authError(e); }
}

export async function resendVerification() {
  if (auth.currentUser) await sendEmailVerification(auth.currentUser);
}

export async function reloadUser() {
  await auth.currentUser?.reload();
  tokenCache = null;
  return auth.currentUser;
}

export async function resetPassword(email: string) {
  try { await sendPasswordResetEmail(auth, email.trim()); } catch (e) { throw authError(e); }
}

export async function signInGoogle() {
  try {
    if (Capacitor.isNativePlatform()) {
      const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
      const r = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true, useCredentialManager: false });
      const idToken = r.credential?.idToken;
      if (!idToken) throw new Error('Google sign-in returned no token');
      return await signInWithCredential(auth, GoogleAuthProvider.credential(idToken, r.credential?.accessToken || undefined));
    }
    const p = new GoogleAuthProvider();
    p.setCustomParameters({ prompt: 'select_account' });
    return await signInWithPopup(auth, p);
  } catch (e) { throw authError(e); }
}

export async function logout() {
  tokenCache = null;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('byjan.')) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
    sessionStorage.clear();
  } catch { /* private mode */ }
  if (Capacitor.isNativePlatform()) {
    try {
      const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
      await Promise.race([FirebaseAuthentication.signOut(), new Promise((r) => setTimeout(r, 4000))]);
    } catch { /* already signed out */ }
  }
  await signOut(auth);
}

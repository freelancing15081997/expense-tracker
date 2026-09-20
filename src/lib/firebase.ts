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
  deleteUser,
  type UserCredential,
} from 'firebase/auth';

const WEB_GOOGLE_CLIENT_ID = '450686107760-hdlb65udu9lfo4u087ui439m13dtqkt5.apps.googleusercontent.com';
void WEB_GOOGLE_CLIENT_ID;
const NATIVE_AUTH_SCHEME = 'com.byjanbooks.app://auth';

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

let nativeAuthBridgeBound = false;

function googleSignInError(err: unknown) {
  const anyErr = err as { code?: unknown; message?: unknown };
  const code = String(anyErr?.code || '');
  const message = String(anyErr?.message || '');
  const blob = `${code} ${message}`;
  // Play Store / release builds: missing App Signing fingerprint in Firebase → ApiException 10
  if (/10\b|DEVELOPER_ERROR|ApiException:\s*10/i.test(blob)) {
    return new Error(
      'Google sign-in is not ready for this Play Store install yet. Please update the app after the next release, or use email sign-in for now.',
    );
  }
  // Misconfigured OAuth / Credential Manager often surfaces as BAD_AUTHENTICATION — not the user's fault
  if (/\[16\]|Account reauth failed|BAD_AUTHENTICATION|Long live credential|CommonStatusCodes\.SIGN_IN_REQUIRED/i.test(blob)) {
    return new Error(
      'Google could not complete sign-in on this install. Please try again once, or use email sign-in. You do not need to remove your Google account from the phone.',
    );
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request' || /12501|canceled|cancelled|Authorization canceled/i.test(message)) {
    return new Error('Google sign-in was cancelled.');
  }
  return err instanceof Error ? err : new Error(message || 'Failed to sign in with Google');
}

function nativeAppFlag() {
  try {
    const hash = String(window.location.hash || '');
    const q = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : window.location.search.replace(/^\?/, '');
    return new URLSearchParams(q).get('nativeApp') === '1';
  } catch {
    return false;
  }
}

export function parseGoogleIdTokenFromUrl(url: string) {
  const raw = String(url || '');
  const normalized = raw.replace(/^com\.byjanbooks\.app:\/\//i, 'https://auth.byjanbooks.app/');
  try {
    const parsed = new URL(normalized);
    const fromQuery = parsed.searchParams.get('idToken') || parsed.searchParams.get('id_token') || '';
    if (fromQuery) return fromQuery;
    const hash = parsed.hash.replace(/^#/, '');
    if (hash) {
      const params = new URLSearchParams(hash);
      return params.get('idToken') || params.get('id_token') || '';
    }
  } catch { /* ignore */ }
  const match = raw.match(/idToken=([^&#]+)/i) || raw.match(/id_token=([^&#]+)/i);
  return match ? decodeURIComponent(match[1]) : '';
}

export async function completeGoogleIdTokenSignIn(idToken: string) {
  return signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
}

/** Keep a permanent bridge so Custom Tab deep-links always finish native auth. */
export function bindNativeGoogleAuthBridge() {
  if (nativeAuthBridgeBound || typeof window === 'undefined') return;
  nativeAuthBridgeBound = true;
  window.addEventListener('byjan-google-auth', (event) => {
    const detail = (event as CustomEvent<string>).detail;
    const token = parseGoogleIdTokenFromUrl(String(detail || ''));
    if (!token) return;
    void completeGoogleIdTokenSignIn(token).catch((err) => {
      console.error('Native Google handoff failed', err);
    });
  });
}

export async function handoffGoogleToNativeApp(result: UserCredential | null | undefined) {
  if (!result || !nativeAppFlag()) return false;
  const oauth = GoogleAuthProvider.credentialFromResult(result);
  const tokenResponse = (result as { _tokenResponse?: { oauthIdToken?: string } })._tokenResponse;
  const token = String(oauth?.idToken || tokenResponse?.oauthIdToken || '').trim();
  if (!token) return false;
  window.location.href = `${NATIVE_AUTH_SCHEME}#idToken=${encodeURIComponent(token)}`;
  return true;
}

export async function signInWithGoogle() {
  try {
    if (!sessionStorage.getItem('byjan.returnTo')) sessionStorage.setItem('byjan.returnTo', '/');
  } catch { /* private mode */ }

  if (Capacitor.isNativePlatform()) {
    bindNativeGoogleAuthBridge();
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');

    try {
      // Classic Google Sign-In only. Credential Manager + auto-retry opened the
      // account chooser twice and still failed on Play builds missing OAuth SHA.
      const result = await FirebaseAuthentication.signInWithGoogle({
        skipNativeAuth: true,
        useCredentialManager: false,
      });
      const idToken = result.credential?.idToken;
      const accessToken = result.credential?.accessToken;
      if (!idToken) {
        console.error('Native Google sign-in missing idToken', JSON.stringify(result));
        throw new Error('Google sign-in returned no id token');
      }
      return signInWithCredential(auth, GoogleAuthProvider.credential(idToken, accessToken || undefined));
    } catch (err) {
      console.error('Native Google sign-in failed', err);
      throw googleSignInError(err);
    }
  }

  try {
    const result = await signInWithPopup(auth, googleProvider);
    await handoffGoogleToNativeApp(result);
    return result;
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

export async function deleteCurrentAuthUser() {
  const user = auth.currentUser;
  if (user) {
    try {
      await deleteUser(user);
    } catch (err) {
      console.warn('Client auth delete skipped', err);
    }
  }
  await logout();
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

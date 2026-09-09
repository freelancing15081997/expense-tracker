export { db } from './store';
import { authClient, getJwtToken } from './auth-client';

export type SessionUser = {
  uid: string;
  email: string;
  displayName?: string;
};

let sessionUser: SessionUser | null = null;
const authListeners = new Set<(user: SessionUser | null) => void>();

function emit() {
  authListeners.forEach((fn) => fn(sessionUser));
}

function mapUser(user: any): SessionUser | null {
  if (!user) return null;
  const email = String(user.email || '');
  return {
    uid: String(user.id || user.sub || ''),
    email,
    displayName: String(user.name || email.split('@')[0] || 'User'),
  };
}

export async function hydrateSession() {
  const result = await authClient.getSession();
  sessionUser = mapUser((result as any)?.data?.user);
  auth.currentUser = sessionUser;
  emit();
  return sessionUser;
}

export function onAuthStateChanged(_auth: unknown, cb: (user: SessionUser | null) => void) {
  authListeners.add(cb);
  void hydrateSession().then(() => cb(sessionUser));
  return () => { authListeners.delete(cb); };
}

export const auth = { currentUser: null as SessionUser | null };

export async function signInWithEmailAndPassword(_auth: unknown, email: string, password: string) {
  const result = await authClient.signIn.email({ email, password });
  if ((result as any)?.error) throw new Error((result as any).error.message || 'Failed to sign in');
  const user = await hydrateSession();
  return { user };
}

export async function createUserWithEmailAndPassword(_auth: unknown, email: string, password: string) {
  const result = await authClient.signUp.email({
    name: email.split('@')[0] || 'User',
    email,
    password,
  });
  if ((result as any)?.error) throw new Error((result as any).error.message || 'Failed to create an account');
  const user = await hydrateSession();
  return { user };
}

export async function signInWithGoogle() {
  const callbackURL = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname || '/'}#/`
    : '/';
  const result = await authClient.signIn.social({
    provider: 'google',
    callbackURL,
  });
  if ((result as any)?.error) throw new Error((result as any).error.message || 'Google sign-in failed');
  return hydrateSession();
}

export async function logout() {
  await authClient.signOut();
  sessionUser = null;
  auth.currentUser = null;
  emit();
}

export const signOut = logout;
export const getAccessToken = getJwtToken;

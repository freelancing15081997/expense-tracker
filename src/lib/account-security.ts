import {
  EmailAuthProvider,
  TotpMultiFactorGenerator,
  type TotpSecret,
  applyActionCode,
  confirmPasswordReset,
  getMultiFactorResolver,
  multiFactor,
  reauthenticateWithCredential,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  updatePassword,
  verifyPasswordResetCode,
  type AuthError,
  type MultiFactorError,
  type MultiFactorResolver,
  type User,
} from 'firebase/auth';
import { auth } from './firebase';

/** Email/password accounts created on/after this instant must verify email before using the app. Older accounts stay usable. */
export const ACTIVATION_REQUIRED_AFTER_MS = Date.parse('2026-09-12T00:00:00.000Z');

export const AUTH_APP_NAME = 'Byjan';

export function authErrorMessage(err: unknown, fallback = 'Something went wrong') {
  const code = String((err as AuthError)?.code || '');
  const map: Record<string, string> = {
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/user-not-found': 'No account found for that email.',
    'auth/wrong-password': 'Current password is incorrect.',
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/too-many-requests': 'Too many attempts. Try again in a few minutes.',
    'auth/requires-recent-login': 'Sign in again, then retry this security change.',
    'auth/weak-password': 'Use a password with at least 6 characters.',
    'auth/expired-action-code': 'This link has expired. Request a new one.',
    'auth/invalid-action-code': 'This link is invalid or was already used.',
    'auth/missing-password': 'Password is required.',
    'auth/network-request-failed': 'Network error. Check your connection and try again.',
    'auth/multi-factor-auth-required': 'Enter the code from your authenticator app.',
    'auth/invalid-verification-code': 'That authenticator code is invalid.',
    'auth/maximum-second-factor-count-exceeded': 'MFA is already enabled on this account.',
    'auth/second-factor-already-in-use': 'That authenticator is already enrolled.',
    'auth/unsupported-first-factor': 'MFA is not available for this sign-in method yet.',
    'auth/operation-not-allowed': 'This security feature is not enabled on the Firebase project yet.',
  };
  if (code && map[code]) return map[code];
  const message = String((err as Error)?.message || '').trim();
  if (message && !message.startsWith('Firebase:')) return message;
  return fallback;
}

export function hasPasswordProvider(user: User | null | undefined) {
  return Boolean(user?.providerData?.some((p) => p.providerId === 'password'));
}

export function needsEmailActivation(user: User | null | undefined) {
  if (!user || user.emailVerified) return false;
  if (!hasPasswordProvider(user)) return false;
  const created = Date.parse(user.metadata?.creationTime || '') || 0;
  return created >= ACTIVATION_REQUIRED_AFTER_MS;
}

export function actionContinueUrl(path = '/login') {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${origin}/#${normalized}`;
}

export async function requestPasswordReset(email: string) {
  await sendPasswordResetEmail(auth, email.trim(), {
    url: actionContinueUrl('/login'),
    handleCodeInApp: false,
  });
}

export async function verifyResetCode(oobCode: string) {
  return verifyPasswordResetCode(auth, oobCode);
}

export async function completePasswordReset(oobCode: string, newPassword: string) {
  await confirmPasswordReset(auth, oobCode, newPassword);
}

export async function sendActivationEmail(user: User = auth.currentUser!) {
  if (!user) throw new Error('Sign in to activate your account.');
  await sendEmailVerification(user, {
    url: actionContinueUrl('/activate'),
    handleCodeInApp: false,
  });
}

export async function applyEmailActionCode(oobCode: string) {
  await applyActionCode(auth, oobCode);
  if (auth.currentUser) await reload(auth.currentUser);
}

export async function refreshAuthUser() {
  if (!auth.currentUser) return null;
  await reload(auth.currentUser);
  return auth.currentUser;
}

export async function changePassword(currentPassword: string, nextPassword: string) {
  const user = auth.currentUser;
  if (!user?.email) throw new Error('Sign in again to change your password.');
  if (!hasPasswordProvider(user)) {
    throw new Error('This account signs in with Google. Keep using Google, or contact an admin to add a password.');
  }
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, nextPassword);
}

export function listEnrolledFactors(user: User | null | undefined) {
  if (!user) return [] as Array<{ uid: string; factorId: string; displayName?: string | null }>;
  return multiFactor(user).enrolledFactors.map((f) => ({
    uid: f.uid,
    factorId: f.factorId,
    displayName: f.displayName,
  }));
}

export function hasTotpMfa(user: User | null | undefined) {
  return listEnrolledFactors(user).some((f) => f.factorId === TotpMultiFactorGenerator.FACTOR_ID);
}

export async function startTotpEnrollment(accountEmail?: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in to enable MFA.');
  const session = await multiFactor(user).getSession();
  const secret = await TotpMultiFactorGenerator.generateSecret(session);
  const email = accountEmail || user.email || 'user';
  const qrUrl = secret.generateQrCodeUrl(email, AUTH_APP_NAME);
  return { secret, qrUrl, secretKey: secret.secretKey };
}

export async function finishTotpEnrollment(secret: TotpSecret, code: string, displayName = 'Authenticator app') {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in to enable MFA.');
  const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, code.trim());
  await multiFactor(user).enroll(assertion, displayName);
  await reload(user);
}

export async function unenrollTotpFactor(factorUid?: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in to manage MFA.');
  const factors = multiFactor(user).enrolledFactors;
  const target =
    (factorUid && factors.find((f) => f.uid === factorUid)) ||
    factors.find((f) => f.factorId === TotpMultiFactorGenerator.FACTOR_ID);
  if (!target) throw new Error('No authenticator is enrolled.');
  await multiFactor(user).unenroll(target);
  await reload(user);
}

export function isMultiFactorError(err: unknown): err is MultiFactorError {
  return String((err as AuthError)?.code || '') === 'auth/multi-factor-auth-required';
}

export function resolverFromError(err: MultiFactorError): MultiFactorResolver {
  return getMultiFactorResolver(auth, err);
}

export async function completeTotpSignIn(resolver: MultiFactorResolver, code: string) {
  const hint = resolver.hints.find((h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID);
  if (!hint) throw new Error('This account requires an authenticator code, but no TOTP factor is enrolled.');
  const assertion = TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code.trim());
  return resolver.resolveSignIn(assertion);
}

/** Read Firebase email-action params from search, hash query, or continue URL. */
export function readActionParams(
  search = typeof window !== 'undefined' ? window.location.search : '',
  hash = typeof window !== 'undefined' ? window.location.hash : '',
) {
  const fromSearch = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const hashQuery = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  const fromHash = new URLSearchParams(hashQuery);
  return {
    mode: fromSearch.get('mode') || fromHash.get('mode') || '',
    oobCode: fromSearch.get('oobCode') || fromHash.get('oobCode') || '',
    email: fromSearch.get('email') || fromHash.get('email') || '',
  };
}

// Auth client. VITE_AUTH_MODE=live talks to services/api (/v1/auth/*); anything else runs a local mock.
// Tokens: access token lives in memory only; the refresh token is an httpOnly cookie set by the API.
const strip = (v) => String(v ?? '').trim().replace(/^["']|["']$/g, '');
const API = strip(import.meta.env.VITE_API_URL).replace(/\/$/, '');
const FB_KEY = strip(import.meta.env.VITE_FIREBASE_API_KEY);
const FB_DOMAIN = strip(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN);
export const MOCK = import.meta.env.VITE_AUTH_MODE !== 'live';
export const IDLE_MIN = Number(import.meta.env.VITE_IDLE_MINUTES || 30);

let access = null;
let onSessionLost = null;
export const setOnSessionLost = fn => { onSessionLost = fn; };
export const getAccessToken = () => access;
export const setAccessToken = t => { access = t || null; };

const sleep = ms => new Promise(r => setTimeout(r, ms));
const err = (message, code) => Object.assign(new Error(message), { code });
const MOCK_KEY = 'byjanMockSession';
const MOCK_USER = { id: 'u1', name: 'Ravi Sharma', email: 'ravi@sharmatraders.in', role: 'Owner', sessionTimeoutMin: IDLE_MIN, otherDevices: 3 };

async function call(path, body, { method = 'POST', auth = false } = {}) {
  const r = await fetch(API + '/v1' + path, {
    method, credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(auth && access ? { Authorization: 'Bearer ' + access } : {}) },
    body: method === 'GET' ? undefined : JSON.stringify(body || {}),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const d = j?.error ?? j?.detail ?? j?.title;
    const message = typeof d === 'string' ? d
      : (d?.message || d?.code || j?.message || 'Something went wrong. Try again.');
    throw Object.assign(err(String(message), d?.code || j?.code), { status: r.status, payload: j });
  }
  return j;
}

async function takeTokens(j) {
  if (j.mfa_required) return { mfa: true, challengeId: j.challenge_id };
  access = j.access_token;
  const me = await call('/me', null, { method: 'GET', auth: true });
  return { user: normUser(me) };
}
const normUser = me => ({ id: me.id, name: me.name || me.email || me.phone, email: me.email, phone: me.phone, role: me.tenants?.[0]?.role || '', sessionTimeoutMin: me.session_timeout_min || IDLE_MIN, otherDevices: me.other_sessions ?? 0 });

// Restore a session on page load (refresh cookie → new access token).
export async function restore() {
  if (MOCK) { await sleep(250); try { return JSON.parse(sessionStorage.getItem(MOCK_KEY)); } catch (e) { return null; } }
  try { const j = await call('/auth/refresh'); return (await takeTokens(j)).user || null; } catch (e) { return null; }
}

// Phone sign-in is switched off for now (email + Google only).

export async function emailSignUp(name, email, password) {
  if (MOCK) { await sleep(900); if (email.toLowerCase().startsWith('taken@')) throw err('An account with this email already exists. Sign in instead.'); return mockIn({ ...MOCK_USER, name, email, otherDevices: 0 }); }
  const r = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + FB_KEY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) });
  const j = await r.json();
  if (!r.ok) {
    const m = j?.error?.message || '';
    throw err(/EMAIL_EXISTS/.test(m) ? 'An account with this email already exists. Sign in instead.' : /WEAK_PASSWORD/.test(m) ? 'Choose a stronger password (8+ characters).' : 'We couldn’t create your account. Try again.');
  }
  await fetch('https://identitytoolkit.googleapis.com/v1/accounts:update?key=' + FB_KEY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: j.idToken, displayName: name }) }).catch(() => {});
  return takeTokens(await call('/auth/firebase/exchange', { id_token: j.idToken, name }));
}

// Email + password is owned by Firebase; we exchange its ID token for our own tokens.
export async function passwordSignIn(email, password) {
  if (MOCK) { await sleep(800); if (password === 'wrong123') throw err('That email and password don’t match. 4 tries left before a 15-minute lock.'); return { mfa: true, challengeId: 'mock' }; }
  const r = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + FB_KEY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) });
  const j = await r.json();
  if (!r.ok) throw err(/TOO_MANY/.test(j?.error?.message) ? 'Too many tries. Wait 15 minutes or reset your password.' : 'That email and password don’t match.');
  return takeTokens(await call('/auth/firebase/exchange', { id_token: j.idToken }));
}

export async function googleSignIn() {
  if (MOCK) { await sleep(900); return mockIn(); }
  const [{ initializeApp }, fa] = await Promise.all([import('firebase/app'), import('firebase/auth')]);
  const app = initializeApp({ apiKey: FB_KEY, authDomain: FB_DOMAIN });
  const cred = await fa.signInWithPopup(fa.getAuth(app), new fa.GoogleAuthProvider());
  return takeTokens(await call('/auth/firebase/exchange', { id_token: await cred.user.getIdToken() }));
}

export async function mfaChallenge(challengeId, code, recovery, trustDevice) {
  if (MOCK) { await sleep(700); if (code === '000000') throw err('That code didn’t work. Check your phone’s time is set automatically.'); return mockIn(); }
  return takeTokens(await call('/auth/mfa/challenge', { challenge_id: challengeId, [recovery ? 'recovery_code' : 'code']: code, trust_device: trustDevice }));
}

export async function sendPasswordReset(email) {
  if (MOCK) { await sleep(700); return; }
  // Branded Brevo mail from byjanbooks@easypado.com (not Firebase's default spam-prone sender).
  // Always resolves: don't reveal whether the email has an account.
  await call('/auth/password-reset/request', { email }).catch(() => {});
}

export async function signOut({ allDevices = false } = {}) {
  if (MOCK) { await sleep(600); }
  else {
    try { if (allDevices) await call('/me/sessions/revoke-others', null, { auth: true }); } catch (e) {}
    try { await call('/auth/logout', null, { auth: true }); } catch (e) {}
  }
  clearLocal();
}

export function clearLocal() {
  access = null;
  try { sessionStorage.removeItem(MOCK_KEY); localStorage.removeItem('byjanLastActive'); } catch (e) {}
}

function mockIn(u = MOCK_USER) { try { sessionStorage.setItem(MOCK_KEY, JSON.stringify(u)); } catch (e) {} return { user: u }; }

// Use for every other API call: adds the Bearer token and refreshes once on 401.
export async function authFetch(path, init = {}) {
  const go = () => fetch(API + path, { ...init, credentials: 'include', headers: { ...(init.headers || {}), ...(access ? { Authorization: 'Bearer ' + access } : {}) } });
  let r = await go();
  if (r.status === 401 && !MOCK) {
    try { const j = await call('/auth/refresh'); access = j.access_token; r = await go(); }
    catch (e) { clearLocal(); onSessionLost && onSessionLost(e.code === 'auth.refresh_reused' ? 'reused' : 'revoked'); }
  }
  return r;
}

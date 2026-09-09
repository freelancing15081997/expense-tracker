import { createRemoteJWKSet, jwtVerify } from 'jose';
import { randomBytes } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import { sendJson } from './http';

export { applyCors, authBaseUrl, readJsonBody, requestPath, sendJson, ALLOWED_API_METHODS } from './http';
export { kvDel, kvGet, kvList, kvListPrefix, kvSet } from './db';

const FIREBASE_PROJECT = 'gen-lang-client-0616065043';
let firebaseJwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getFirebaseJwks() {
  if (!firebaseJwks) {
    firebaseJwks = createRemoteJWKSet(
      new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
    );
  }
  return firebaseJwks;
}

function readCookies(req: IncomingMessage) {
  const raw = String(req.headers.cookie || '');
  const out: Record<string, string> = {};
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function extractToken(req: IncomingMessage) {
  const header = String(req.headers.authorization || '');
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
  const cookies = readCookies(req);
  return cookies['better-auth.jwt'] || cookies['__Secure-better-auth.jwt'] || '';
}

export type NeonSession = {
  uid: string;
  email: string;
  displayName: string;
};

export async function readNeonSession(req: IncomingMessage): Promise<NeonSession | null> {
  const token = extractToken(req);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getFirebaseJwks(), {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT}`,
      audience: FIREBASE_PROJECT,
    });
    const uid = String(payload.user_id || payload.sub || '');
    if (!uid) return null;
    return {
      uid,
      email: String(payload.email || ''),
      displayName: String(payload.name || String(payload.email || '').split('@')[0] || 'User'),
    };
  } catch {
    return null;
  }
}

export async function readSession(req: IncomingMessage): Promise<string | null> {
  const session = await readNeonSession(req);
  return session?.uid || null;
}

export async function requireUser(req: IncomingMessage, res: ServerResponse): Promise<string | null> {
  const uid = await readSession(req);
  if (!uid) {
    sendJson(res, 401, { error: 'Sign in required' });
    return null;
  }
  return uid;
}

export function newId() {
  return randomBytes(12).toString('hex');
}

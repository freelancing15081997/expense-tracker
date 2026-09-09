import { createRemoteJWKSet, jwtVerify } from 'jose';
import { randomBytes } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
export { kvDel, kvGet, kvList, kvSet } from './db';

export function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
}

function authBaseUrl() {
  const raw = process.env.NEON_AUTH_BASE_URL || process.env.VITE_NEON_AUTH_URL || '';
  return raw.replace(/\/+$/, '');
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks() {
  const base = authBaseUrl();
  if (!base) throw new Error('Neon Auth is not configured. Set NEON_AUTH_BASE_URL.');
  if (!jwks) jwks = createRemoteJWKSet(new URL(`${base}/.well-known/jwks.json`));
  return jwks;
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
  const base = authBaseUrl();
  if (!base) return null;
  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      issuer: new URL(base).origin,
    });
    const uid = String(payload.sub || payload.id || '');
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

export async function readJsonBody(req: IncomingMessage & { body?: unknown }) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body as any;
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const secret = () => process.env.JWT_SECRET || 'byjan-dev-secret';

function b64(value: string) {
  return Buffer.from(value).toString('base64url');
}

export function signJwt(payload: Record<string, unknown>, ttlSec: number) {
  const body = b64(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSec }));
  const sig = createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function readJwt(token: string): Record<string, unknown> | null {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expect = createHmac('sha256', secret()).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const json = JSON.parse(Buffer.from(body, 'base64url').toString()) as { exp?: number };
  if (!json.exp || json.exp < Math.floor(Date.now() / 1000)) return null;
  return json;
}

export function issueSession(userId: string) {
  const token = signJwt({ sub: userId, typ: 'access' }, 15 * 60);
  const refreshToken = signJwt({ sub: userId, typ: 'refresh', jti: randomBytes(8).toString('hex') }, 30 * 24 * 3600);
  return { token, refreshToken };
}

export function signBody(body: string, key = process.env.WEBHOOK_SECRET || 'byjan-dev-webhook') {
  return createHmac('sha256', key).update(body).digest('hex');
}

export function verifyBody(body: string, given: string) {
  const expect = signBody(body);
  const a = Buffer.from(given || '');
  const b = Buffer.from(expect);
  return a.length === b.length && timingSafeEqual(a, b);
}

import type { IncomingMessage, ServerResponse } from 'http';
import { applyCors, authBaseUrl, requestPath, sendJson } from './http';

const FORWARD = new Set([
  'accept',
  'authorization',
  'content-type',
  'cookie',
  'origin',
  'referer',
  'user-agent',
  'x-csrf-token',
]);

export function neonAuthSuffix(pathname: string) {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/api/auth' || clean === '/neondb/auth') return '';
  return clean
    .replace(/^\/api\/auth\/?/, '')
    .replace(/^\/neondb\/auth\/?/, '')
    .replace(/^\/+/, '');
}

function suffixFromRequest(req: IncomingMessage, fallback: string) {
  const url = requestPath(req);
  const fromPath = neonAuthSuffix(url.pathname);
  if (fromPath) return fromPath;
  const query = (req as IncomingMessage & { query?: Record<string, string | string[]> }).query || {};
  const catchAll = query.path ?? query.all;
  if (Array.isArray(catchAll) && catchAll.length) return catchAll.join('/');
  if (typeof catchAll === 'string' && catchAll) return catchAll;
  return String(fallback || '').replace(/^\/+/, '');
}

async function readRawBody(req: IncomingMessage & { body?: unknown }): Promise<Buffer | undefined> {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body);
  if (req.body && typeof req.body === 'object') return Buffer.from(JSON.stringify(req.body));
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

export async function proxyToNeonAuth(req: IncomingMessage & { body?: unknown }, res: ServerResponse, suffix: string) {
  applyCors(req, res);
  const base = authBaseUrl();
  if (!base) {
    sendJson(res, 503, { error: 'Neon Auth is not configured. Set NEON_AUTH_BASE_URL on Vercel (Production).' });
    return;
  }

  const incoming = requestPath(req);
  const path = suffixFromRequest(req, suffix);
  const target = `${base}${path ? `/${path}` : ''}${incoming.search}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    const name = key.toLowerCase();
    if (!FORWARD.has(name) || !value) continue;
    headers.set(name, Array.isArray(value) ? value.join('; ') : value);
  }
  const origin = String(req.headers.origin || '').trim();
  if (origin) headers.set('origin', origin);

  const init: RequestInit = { method: req.method || 'GET', headers, redirect: 'manual' };
  const method = String(req.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    const body = await readRawBody(req);
    if (body && body.length) {
      init.body = new Uint8Array(body);
      if (!headers.has('content-type')) headers.set('content-type', 'application/json');
    }
  }

  try {
    const upstream = await fetch(target, init);
    res.statusCode = upstream.status;
    const cookies = typeof upstream.headers.getSetCookie === 'function' ? upstream.headers.getSetCookie() : [];
    if (cookies.length) res.setHeader('set-cookie', cookies);
    upstream.headers.forEach((value, key) => {
      const name = key.toLowerCase();
      if (name === 'set-cookie' || name === 'content-encoding' || name === 'content-length' || name === 'transfer-encoding') return;
      res.setHeader(key, value);
    });
    res.setHeader('content-type', upstream.headers.get('content-type') || 'application/json');
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.end(buf);
  } catch (err: any) {
    sendJson(res, 502, { error: err?.message || 'Auth proxy failed' });
  }
}

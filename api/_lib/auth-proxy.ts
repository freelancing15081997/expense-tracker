import type { IncomingMessage, ServerResponse } from 'http';
import { applyCors, authBaseUrl, readJsonBody, sendJson } from './helpers';

const HOP = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade', 'host', 'content-length']);

export function neonAuthSuffix(pathname: string) {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/api/auth' || clean === '/neondb/auth') return '';
  return clean.replace(/^\/api\/auth\/?/, '').replace(/^\/neondb\/auth\/?/, '');
}

export async function proxyToNeonAuth(req: IncomingMessage & { body?: unknown }, res: ServerResponse, suffix: string) {
  applyCors(req, res);
  const base = authBaseUrl();
  if (!base) {
    sendJson(res, 503, { error: 'Neon Auth is not configured. Set NEON_AUTH_BASE_URL and VITE_NEON_AUTH_URL.' });
    return;
  }

  const incoming = new URL(String((req as IncomingMessage & { originalUrl?: string }).originalUrl || req.url || '/'), 'http://local');
  const path = String(suffix || '').replace(/^\/+/, '');
  const target = `${base}${path ? `/${path}` : ''}${incoming.search}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (!value || HOP.has(key.toLowerCase())) continue;
    headers.set(key, Array.isArray(value) ? value.join(', ') : value);
  }

  const init: RequestInit = { method: req.method || 'GET', headers, redirect: 'manual' };
  if (req.method && !['GET', 'HEAD'].includes(req.method.toUpperCase())) {
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      if (!headers.has('content-type')) headers.set('content-type', 'application/json');
      init.body = JSON.stringify(req.body);
    } else {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      if (chunks.length) init.body = Buffer.concat(chunks);
    }
  }

  try {
    const upstream = await fetch(target, init);
    res.statusCode = upstream.status;
    upstream.headers.forEach((value, key) => {
      if (HOP.has(key.toLowerCase())) return;
      if (key.toLowerCase() === 'set-cookie') return;
      res.setHeader(key, value);
    });
    const cookies = typeof upstream.headers.getSetCookie === 'function'
      ? upstream.headers.getSetCookie()
      : [];
    if (cookies.length) res.setHeader('set-cookie', cookies);
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.end(buf);
  } catch (err: any) {
    sendJson(res, 502, { error: err?.message || 'Auth proxy failed' });
  }
}

export async function readBodyIfNeeded(req: IncomingMessage & { body?: unknown }) {
  if (req.body !== undefined) return req.body;
  try {
    return await readJsonBody(req);
  } catch {
    return {};
  }
}

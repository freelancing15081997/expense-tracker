import type { IncomingMessage, ServerResponse } from 'http';

export const ALLOWED_API_METHODS = 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS';

export function requestPath(req: IncomingMessage) {
  const raw = String((req as IncomingMessage & { originalUrl?: string }).originalUrl || req.url || '/');
  try {
    return new URL(raw, 'http://local.invalid');
  } catch {
    return new URL('http://local.invalid/');
  }
}

export function applyCors(req: IncomingMessage, res: ServerResponse) {
  const origin = String(req.headers.origin || '').trim();
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  if (origin) res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', ALLOWED_API_METHODS);
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Authorization,Content-Type,X-CSRF-Token,X-Requested-With,Accept,Accept-Version,Content-Length,X-Tenant-Id,X-File-Id,X-File-Ext,X-File-Name,X-Content-Type,X-Api-Version',
  );
  res.setHeader('Allow', ALLOWED_API_METHODS);
  res.setHeader('Access-Control-Max-Age', '86400');
}

export function sendJson(res: ServerResponse, status: number, payload: unknown) {
  if (res.headersSent) return;
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
}

export function authBaseUrl() {
  const raw = process.env.NEON_AUTH_BASE_URL || process.env.VITE_NEON_AUTH_URL || '';
  return String(raw).trim().replace(/^["']|["']$/g, '').replace(/\/+$/, '');
}

export async function readJsonBody(req: IncomingMessage & { body?: unknown }) {
  if (Buffer.isBuffer(req.body)) {
    const raw = req.body.toString('utf8');
    return raw ? JSON.parse(raw) : {};
  }
  if (typeof req.body === 'string') return req.body ? JSON.parse(req.body) : {};
  if (req.body && typeof req.body === 'object') return req.body as Record<string, unknown>;
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

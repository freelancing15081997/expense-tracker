import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { getIdToken } from './firebase';

const NATIVE_ORIGIN = String(import.meta.env.VITE_API_URL || 'https://www.easypado.com').replace(/\/+$/, '');

export function isNative() {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
}

export function apiUrl(path: string) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return isNative() ? `${NATIVE_ORIGIN}${p}` : p;
}

/** Every failure carries status + machine code so screens can branch (QUOTA_EXCEEDED, PLAN_REQUIRED…). */
export class ApiError extends Error {
  status: number;
  code: string;
  extra: Record<string, unknown>;
  constructor(status: number, payload: Record<string, unknown>) {
    super(friendly(status, String(payload.error || payload.message || '')));
    this.status = status;
    this.code = String(payload.code || (status === 402 ? 'QUOTA_EXCEEDED' : status === 401 ? 'AUTH' : status === 403 ? 'FORBIDDEN' : 'ERROR'));
    this.extra = payload;
  }
}

function friendly(status: number, raw: string) {
  const technical = /smtp|postgres|neon|firebase|ECONN|stack|TypeError|at\s+\S+\(/i.test(raw);
  if (raw && !technical) return raw;
  if (status === 0) return 'No internet. Your change is saved and will sync when you are back online.';
  if (status === 401) return 'Please sign in again to continue.';
  if (status === 402) return 'You have used this month’s limit for this feature.';
  if (status === 403) return 'You do not have permission to do that.';
  if (status === 404) return 'That item no longer exists.';
  if (status === 409) return 'This looks like a duplicate.';
  if (status === 429) return 'Too many requests. Try again in a moment.';
  if (status >= 500) return 'The service is busy right now. Please try again.';
  return 'Something went wrong. Please try again.';
}

function decode(status: number, data: unknown): Record<string, unknown> {
  if (data == null || data === '') return {};
  if (Array.isArray(data)) return { docs: data };
  if (typeof data === 'object') return data as Record<string, unknown>;
  const s = String(data).trim();
  if (s.startsWith('<')) throw new ApiError(502, { error: 'The app reached a web page instead of the API. Check your connection.' });
  try { const j = JSON.parse(s); return Array.isArray(j) ? { docs: j } : j; } catch { throw new ApiError(status >= 500 ? status : 502, {}); }
}

async function headers(json = true) {
  const h: Record<string, string> = {};
  if (json) h['Content-Type'] = 'application/json';
  let token = await getIdToken();
  for (let i = 0; !token && isNative() && i < 20; i++) {
    await new Promise((r) => setTimeout(r, 150));
    token = await getIdToken();
  }
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

const timeoutFor = (path: string) => (path.includes('/email/') || path.includes('processReceipt') ? 60000 : 30000);

export async function apiPost<T = Record<string, unknown>>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  const url = apiUrl(path);
  const h = await headers();
  const timeout = timeoutFor(path + String(body.op || ''));
  if (isNative()) {
    try {
      const res = await CapacitorHttp.post({ url, headers: h, data: body, connectTimeout: timeout, readTimeout: timeout });
      const payload = decode(res.status, res.data);
      if (res.status < 200 || res.status >= 300) throw new ApiError(res.status, payload);
      return payload as T;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError(0, {});
    }
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { method: 'POST', headers: h, body: JSON.stringify(body), credentials: 'include', signal: ctrl.signal });
    const payload = decode(res.status, await res.text());
    if (!res.ok) throw new ApiError(res.status, payload);
    return payload as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if ((e as Error).name === 'AbortError') throw new ApiError(504, { error: 'This is taking longer than expected. Please try again.' });
    throw new ApiError(0, {});
  } finally {
    clearTimeout(t);
  }
}

/** Upload raw bytes to /api/blob/upload (same headers contract as the live app). */
export async function apiUpload(input: { bookId: string; fileId: string; ext: string; mime: string; fileName: string; base64: string; bytes: Uint8Array }) {
  const h = await headers(false);
  Object.assign(h, {
    'Content-Type': input.mime,
    'x-book-id': input.bookId,
    'x-file-id': input.fileId,
    'x-file-ext': input.ext,
    'x-file-name': encodeURIComponent(input.fileName),
    'x-content-type': input.mime,
  });
  const url = apiUrl('/api/blob/upload');
  let status = 0; let data: unknown = '';
  if (isNative()) {
    const res = await CapacitorHttp.request({ url, method: 'POST', headers: h, data: input.base64, dataType: 'file', connectTimeout: 30000, readTimeout: 30000 });
    status = res.status; data = res.data;
  } else {
    const ab = input.bytes.buffer.slice(input.bytes.byteOffset, input.bytes.byteOffset + input.bytes.byteLength) as ArrayBuffer;
    const res = await fetch(url, { method: 'POST', headers: h, body: new Blob([ab], { type: input.mime }) });
    status = res.status; data = await res.text();
  }
  const payload = decode(status, data);
  if (status < 200 || status >= 300) throw new ApiError(status, payload);
  const path = String(payload.path || payload.pathname || payload.url || '');
  if (!path) throw new ApiError(502, { error: 'Upload did not return a file path.' });
  return path;
}

export function fileUrl(path: string) {
  if (!path) return '';
  if (/^(https?:|data:)/.test(path)) return path;
  return apiUrl(`/api/blob/file?path=${encodeURIComponent(path)}`);
}

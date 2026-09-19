import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { authHeaders } from './auth-client';

const NATIVE_API_ORIGIN = String(import.meta.env.VITE_API_URL || 'https://www.easypado.com').replace(/\/+$/, '');

/** True only inside Capacitor / Ionic shells — never treat the public website as native. */
export function isNativeApp() {
  try {
    if (Capacitor.isNativePlatform()) return true;
  } catch {
    /* bridge not ready */
  }
  if (typeof window === 'undefined') return false;
  const protocol = window.location.protocol;
  return protocol === 'capacitor:' || protocol === 'ionic:';
}

export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (!isNativeApp()) return normalized;
  return `${NATIVE_API_ORIGIN}${normalized}`;
}

function failPayload(status: number, payload: Record<string, unknown>) {
  const raw = String(payload.error || `Request failed (${status})`);
  // Keep server-provided friendly copy; strip obvious technical leftovers.
  const technical = /smtp|postgres|neon|firebase|resource-exhausted|ECONN|stack|TypeError|at\s+\S+\(/i.test(raw);
  const message = technical
    ? (status === 429
      ? 'This service is temporarily at its limit. Please try again in a little while.'
      : status >= 500
        ? 'The service is busy right now. Please try again in a moment.'
        : status === 403
          ? 'You do not have permission to do that.'
          : status === 401
            ? 'Please sign in again to continue.'
            : 'Something went wrong. Please try again.')
    : raw;
  const err: Error & { status?: number; extra?: unknown } = new Error(message);
  err.status = status;
  err.extra = payload;
  return err;
}

function looksLikeHtml(value: string) {
  const trimmed = value.trimStart();
  return trimmed.startsWith('<') || /^<!doctype/i.test(trimmed);
}

function decodeBody(data: unknown, status = 0): Record<string, unknown> {
  if (data == null || data === '') {
    if (status >= 400) {
      throw failPayload(status || 502, { error: status >= 500 ? 'Server error. Please try again in a moment.' : 'Empty server response. Try again.' });
    }
    return {};
  }
  if (Array.isArray(data)) return { docs: data };
  if (typeof data === 'object') return data as Record<string, unknown>;
  if (typeof data !== 'string') return {};
  const trimmed = data.trim();
  if (!trimmed) {
    throw failPayload(status || 502, { error: status >= 500 ? 'Server error. Please try again in a moment.' : 'Empty server response. Try again.' });
  }
  if (looksLikeHtml(trimmed)) {
    throw failPayload(502, {
      error: 'The app reached a web page instead of the API. Check your connection and try again.',
    });
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    if (Array.isArray(parsed)) return { docs: parsed };
    return { data: parsed };
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) throw err;
    throw failPayload(status >= 500 ? status : 502, { error: status >= 500 ? 'Server error. Please try again in a moment.' : 'The server returned an invalid response. Try again.' });
  }
}

function cleanHeaders(headers: Record<string, string>) {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string' && value) next[key] = value;
  }
  return next;
}

async function fromHttp(status: number, data: unknown) {
  const payload = decodeBody(data, status);
  if (status < 200 || status >= 300) throw failPayload(status, payload);
  return payload;
}

async function nativePost(url: string, headers: Record<string, string>, body: Record<string, unknown>) {
  const res = await CapacitorHttp.post({
    url,
    headers,
    data: body,
    connectTimeout: 30000,
    readTimeout: 30000,
  });
  return fromHttp(res.status, res.data);
}

async function webPost(url: string, headers: Record<string, string>, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method: 'POST',
    credentials: isNativeApp() ? 'omit' : 'include',
    headers,
    body: JSON.stringify(body || {}),
  });
  return fromHttp(res.status, await res.text());
}

let authHeaderCache: { value: string; at: number } | null = null;

async function headersWithAuth(extra: Record<string, string> = {}) {
  const headers = cleanHeaders(await authHeaders(extra));
  if (headers.Authorization) {
    authHeaderCache = { value: headers.Authorization, at: Date.now() };
    return headers;
  }
  // Cold start on Android: wait for Firebase token (do not proceed unauthenticated).
  if (isNativeApp()) {
    for (let i = 0; i < 20 && !headers.Authorization; i++) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      Object.assign(headers, cleanHeaders(await authHeaders(extra)));
    }
    if (headers.Authorization) {
      authHeaderCache = { value: headers.Authorization, at: Date.now() };
      return headers;
    }
  }
  if (authHeaderCache && Date.now() - authHeaderCache.at < 45_000) {
    headers.Authorization = authHeaderCache.value;
  }
  return headers;
}

export function clearApiAuthCache() {
  authHeaderCache = null;
}

export async function apiPost<T>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  const headers = await headersWithAuth({ 'Content-Type': 'application/json' });
  const url = apiUrl(path);

  if (isNativeApp()) {
    const timeout = path.includes('/email/') ? 60000 : 30000;
    try {
      const res = await CapacitorHttp.post({
        url,
        headers,
        data: body,
        connectTimeout: timeout,
        readTimeout: timeout,
      });
      return fromHttp(res.status, res.data) as T;
    } catch (err) {
      try {
        return await webPost(url, headers, body) as T;
      } catch {
        throw err;
      }
    }
  }

  return webPost(url, headers, body) as Promise<T>;
}

export async function apiGet<T>(path: string): Promise<T> {
  const headers = await headersWithAuth();
  const url = apiUrl(path);
  if (isNativeApp()) {
    const res = await CapacitorHttp.get({ url, headers, connectTimeout: 30000, readTimeout: 30000 });
    return fromHttp(res.status, res.data) as T;
  }
  const res = await fetch(url, { credentials: 'include', headers });
  return fromHttp(res.status, await res.text()) as T;
}

import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { authHeaders } from './auth-client';

const NATIVE_API_ORIGIN = String(import.meta.env.VITE_API_URL || 'https://www.easypado.com').replace(/\/+$/, '');

export function isNativeApp() {
  try {
    if (Capacitor.isNativePlatform()) return true;
  } catch {
    /* bridge not ready */
  }
  if (typeof window === 'undefined') return false;
  const protocol = window.location.protocol;
  const host = window.location.hostname;
  return protocol === 'capacitor:' || protocol === 'ionic:' || (protocol === 'https:' && (host === 'localhost' || host === 'app.byjan.com' || host === 'www.easypado.com'));
}

export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (!isNativeApp()) return normalized;
  return `${NATIVE_API_ORIGIN}${normalized}`;
}

function failPayload(status: number, payload: Record<string, unknown>) {
  const err: Error & { status?: number; extra?: unknown } = new Error(String(payload.error || `Request failed (${status})`));
  err.status = status;
  err.extra = payload;
  return err;
}

function looksLikeHtml(value: string) {
  const trimmed = value.trimStart();
  return trimmed.startsWith('<') || /^<!doctype/i.test(trimmed);
}

function decodeBody(data: unknown): Record<string, unknown> {
  if (data == null || data === '') return {};
  if (Array.isArray(data)) return { docs: data };
  if (typeof data === 'object') return data as Record<string, unknown>;
  if (typeof data !== 'string') return {};
  const trimmed = data.trim();
  if (!trimmed) return {};
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
    throw failPayload(502, { error: 'The server returned an invalid response. Try again.' });
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
  const payload = decodeBody(data);
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

export async function apiPost<T>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  const headers = cleanHeaders(await authHeaders({
    'Content-Type': 'application/json',
  }));
  if (isNativeApp() && !headers.Authorization) {
    for (let i = 0; i < 15 && !headers.Authorization; i++) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      Object.assign(headers, cleanHeaders(await authHeaders({
        'Content-Type': 'application/json',
      })));
    }
  }
  const url = apiUrl(path);

  if (isNativeApp()) {
    try {
      return await nativePost(url, headers, body) as T;
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
  const headers = cleanHeaders(await authHeaders());
  const url = apiUrl(path);
  if (isNativeApp()) {
    const res = await CapacitorHttp.get({ url, headers, connectTimeout: 30000, readTimeout: 30000 });
    return fromHttp(res.status, res.data) as T;
  }
  const res = await fetch(url, { credentials: 'include', headers });
  return fromHttp(res.status, await res.text()) as T;
}

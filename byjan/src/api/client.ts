/**
 * HTTP client for the Byjan backend.
 *
 * Every service function in ./services calls `api()` with a real method + path AND a mock.
 * - While EXPO_PUBLIC_API_URL is unset (or EXPO_PUBLIC_USE_MOCKS=1) the mock is returned after a small delay.
 * - Set EXPO_PUBLIC_API_URL=https://api.byjan.app to hit the real backend; mocks are then ignored.
 *
 * Search the codebase for `PLACEHOLDER` to find every endpoint that needs a real implementation.
 */

export const API_BASE_URL: string = process.env.EXPO_PUBLIC_API_URL ?? '';
export const USE_MOCKS: boolean = !API_BASE_URL || process.env.EXPO_PUBLIC_USE_MOCKS === '1';

let authToken: string | null = null;
let refreshToken: string | null = null;
let simulateFailure = false;
let refreshing: Promise<boolean> | null = null;

export const setAuthToken = (t: string | null) => { authToken = t; };
export const setRefreshToken = (t: string | null) => { refreshToken = t; };

type QueuedEntry = { body: unknown };
const offlineEntries: QueuedEntry[] = [];

export function offlineQueueSize() { return offlineEntries.length; }

/** Replay entries saved while the device had no network. */
export async function flushOfflineQueue(): Promise<number> {
  if (USE_MOCKS || offlineEntries.length === 0) return 0;
  const pending = offlineEntries.splice(0, offlineEntries.length);
  let sent = 0;
  for (const item of pending) {
    try {
      const res = await fetch(API_BASE_URL + '/v1/entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify(item.body),
      });
      if (res.ok) sent += 1;
      else offlineEntries.push(item);
    } catch {
      offlineEntries.push(item);
    }
  }
  return sent;
}

async function refreshAccess(): Promise<boolean> {
  if (!refreshToken || USE_MOCKS) return false;
  if (!refreshing) {
    refreshing = (async () => {
      const res = await fetch(API_BASE_URL + '/v1/auth/refresh', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) { authToken = null; refreshToken = null; return false; }
      const json = await res.json();
      authToken = json.token;
      if (json.refreshToken) refreshToken = json.refreshToken;
      return true;
    })().finally(() => { refreshing = null; });
  }
  return refreshing;
}
export const setSimulateFailure = (v: boolean) => { simulateFailure = v; };

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface Options<T> {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** Mock response used until the real endpoint is wired up. */
  mock: T | (() => T);
  /** Mock latency in ms. */
  delay?: number;
  /** Error to raise in mock mode when the dev "Simulate failures" switch is on. */
  mockError?: ApiError;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function api<T>(method: Method, path: string, opts: Options<T>): Promise<T> {
  if (USE_MOCKS) {
    await sleep(opts.delay ? Math.min(opts.delay, 450) : 120); // short mock latency; flows that show progress (UPI, checkout) keep a brief wait
    if (simulateFailure) throw opts.mockError ?? new ApiError(503, 'SERVER_UNAVAILABLE', "Server didn't respond");
    const m = opts.mock;
    return typeof m === 'function' ? (m as () => T)() : structuredCloneSafe(m);
  }

  const qs = opts.query
    ? '?' + Object.entries(opts.query).filter(([, v]) => v !== undefined).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')
    : '';
  let res: Response;
  try {
    res = await fetch(API_BASE_URL + path + qs, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    if (method === 'POST' && path === '/v1/entries' && opts.body !== undefined) {
      offlineEntries.push({ body: opts.body });
      const b = opts.body as { bookId?: string; amount?: number; title?: string; category?: string; paidBy?: string; split?: { members?: string[] } };
      return {
        id: 'offline', bookId: b.bookId ?? '', title: b.title ?? 'Entry', category: b.category ?? 'Other', icon: 'receipt',
        paidBy: b.paidBy ?? 'AK', amount: b.amount ?? 0, splitWith: b.split?.members ?? [], time: 'now', dayLabel: 'Today', yourNet: 0,
      } as T;
    }
    throw new ApiError(0, 'NETWORK', "You're offline");
  }
  if (res.status === 401 && !path.endsWith('/auth/refresh') && await refreshAccess()) {
    return api(method, path, opts);
  }
  const text = await res.text();
  const json = text ? JSON.parse(text) : undefined;
  if (!res.ok) throw new ApiError(res.status, json?.code ?? 'HTTP_' + res.status, json?.message ?? res.statusText);
  return json as T;
}

/** Multipart upload (receipts, documents, voice clips, import files). */
export async function upload<T>(path: string, file: { uri: string; name: string; type: string }, fields: Record<string, string>, mock: T): Promise<T> {
  if (USE_MOCKS) {
    await sleep(700);
    if (simulateFailure) throw new ApiError(413, 'FILE_TOO_LARGE', 'Files must be under 10 MB');
    return mock;
  }
  const form = new FormData();
  // @ts-expect-error React Native FormData file shape
  form.append('file', file);
  Object.entries(fields).forEach(([k, v]) => form.append(k, v));
  const res = await fetch(API_BASE_URL + path, { method: 'POST', body: form, headers: authToken ? { Authorization: `Bearer ${authToken}` } : {} });
  if (!res.ok) throw new ApiError(res.status, 'UPLOAD_FAILED', 'Upload failed');
  return res.json();
}

function structuredCloneSafe<T>(v: T): T {
  return v === undefined ? v : JSON.parse(JSON.stringify(v));
}

import { authHeaders } from './auth-client';

export async function apiPost<T>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: await authHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String((payload as { error?: string }).error || `Request failed (${res.status})`));
  }
  return payload as T;
}

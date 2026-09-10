import { getAccessToken } from './firebase';

let cached: { token: string; at: number } | null = null;

export async function getJwtToken(): Promise<string | null> {
  try {
    if (cached && Date.now() - cached.at < 50_000) return cached.token;
    const token = await getAccessToken();
    if (token) cached = { token, at: Date.now() };
    return token || null;
  } catch {
    return null;
  }
}

export async function authHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  const token = await getJwtToken();
  return {
    ...(extra || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

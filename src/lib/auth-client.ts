import { getAccessToken } from './firebase';

export async function getJwtToken(): Promise<string | null> {
  try {
    const token = await getAccessToken();
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

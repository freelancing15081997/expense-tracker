import { createAuthClient } from '@neondatabase/neon-js/auth';
import { BetterAuthReactAdapter } from '@neondatabase/neon-js/auth/react/adapters';

function neonAuthConnection() {
  const raw = String(import.meta.env.VITE_NEON_AUTH_URL || '').replace(/\/+$/, '');
  if (raw) {
    try {
      const parsed = new URL(raw);
      return {
        url: parsed.origin,
        basePath: parsed.pathname.replace(/\/+$/, '') || '/neondb/auth',
      };
    } catch {
      return { url: raw, basePath: '' };
    }
  }
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return { url: origin, basePath: '/api/auth' };
}

const conn = neonAuthConnection();

export const authClient = createAuthClient(conn.url, {
  adapter: BetterAuthReactAdapter({
    basePath: conn.basePath,
    fetchOptions: { credentials: 'include' },
  } as any),
});

export async function getJwtToken(): Promise<string | null> {
  const client = authClient as any;
  try {
    if (typeof client.getJWTToken === 'function') {
      const token = await client.getJWTToken();
      if (token) return String(token);
    }
  } catch {
    // continue
  }
  try {
    const result = await client.token?.();
    const token = result?.data?.token;
    if (token) return String(token);
  } catch {
    // continue
  }
  try {
    let headerToken: string | null = null;
    const session = await client.getSession({
      fetchOptions: {
        credentials: 'include',
        onSuccess: (ctx: { response?: Response }) => {
          headerToken = ctx.response?.headers.get('set-auth-jwt') || null;
        },
      },
    });
    return headerToken || session?.data?.session?.token || null;
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

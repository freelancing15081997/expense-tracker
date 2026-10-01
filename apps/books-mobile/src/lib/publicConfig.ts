import { apiPost } from './api';

/** Public, unauthenticated app config (maintenance banner, announcement, min version). Cached for 5 minutes. */
let cache: { at: number; value: Record<string, unknown> } | null = null;
export async function getAppConfigPublic() {
  if (cache && Date.now() - cache.at < 300_000) return cache.value;
  const r = await apiPost<{ config?: Record<string, unknown> }>('/api/saas', { op: 'publicConfig' });
  cache = { at: Date.now(), value: r.config || {} };
  return cache.value as { maintenance?: boolean; maintenanceMessage?: string; announcement?: string; announcementTone?: string; minAppVersion?: string };
}

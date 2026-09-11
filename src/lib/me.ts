import { apiPost } from './api';

export type MeProfile = {
  uid: string;
  email?: string;
  displayName?: string;
  defaultCurrency?: string;
  customCategories?: string[];
  photoURL?: string;
  appPrefs?: Record<string, unknown>;
  createdAt?: unknown;
  [key: string]: unknown;
};

export async function getMe() {
  const payload = await apiPost<{ user?: MeProfile | null }>('/api/me', { op: 'get' });
  return payload.user || null;
}

export async function upsertMe(patch: Record<string, unknown>) {
  const payload = await apiPost<{ user: MeProfile }>('/api/me', { op: 'upsert', patch });
  return payload.user;
}

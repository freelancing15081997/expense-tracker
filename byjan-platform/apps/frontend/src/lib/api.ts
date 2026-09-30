/**
 * API client for Byjan Business backend.
 * Auth tokens come from authApi (in-memory access + httpOnly refresh cookie).
 */

import { authFetch, getAccessToken, MOCK } from '../auth/authApi.js';
import { getTenantId, setTenantId as setBizTenantId } from '../auth/bizApi.js';

const API_URL = (import.meta.env.VITE_API_URL || 'https://api.easypado.com').replace(/\/$/, '');
const APP_URL = import.meta.env.VITE_APP_URL || 'https://business.easypado.com';

export { getAccessToken };
export function setTenantId(id: string) {
  setBizTenantId(id);
}
export { getTenantId };

export function clearTokens() {
  // Session clear is owned by authApi.clearLocal / signOut
}

export async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const path = endpoint.startsWith('/v1') || endpoint.startsWith('http')
    ? endpoint
    : `/v1${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  if (MOCK) {
    return fetch(`${API_URL}${path}`, options);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  const tenant = getTenantId();
  if (tenant) headers['X-Tenant-Id'] = tenant;

  return authFetch(path.startsWith('http') ? path.replace(API_URL, '') : path, {
    ...options,
    headers,
  });
}

export async function apiJson<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await apiRequest(endpoint, options);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    const detail = error.detail;
    throw new Error(
      (typeof detail === 'object' && detail?.message) || detail || `HTTP ${response.status}`
    );
  }
  return response.json();
}

export const api = {
  get: <T = any>(endpoint: string) => apiJson<T>(endpoint, { method: 'GET' }),
  post: <T = any>(endpoint: string, data?: any) =>
    apiJson<T>(endpoint, { method: 'POST', body: JSON.stringify(data) }),
  patch: <T = any>(endpoint: string, data?: any) =>
    apiJson<T>(endpoint, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: <T = any>(endpoint: string) => apiJson<T>(endpoint, { method: 'DELETE' }),
  put: <T = any>(endpoint: string, data?: any) =>
    apiJson<T>(endpoint, { method: 'PUT', body: JSON.stringify(data) }),
};

export { API_URL, APP_URL };

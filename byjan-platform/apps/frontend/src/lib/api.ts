/**
 * API client for Byjan Business backend
 * Connects to Python FastAPI backend on Render
 */

const API_URL = import.meta.env.VITE_API_URL || 'https://api.easypado.com';
const APP_URL = import.meta.env.VITE_APP_URL || 'https://business.easypado.com';

// Auth token management
let accessToken: string | null = null;
let refreshToken: string | null = null;

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem('access_token', access);
  localStorage.setItem('refresh_token', refresh);
}

export function getAccessToken(): string | null {
  if (!accessToken) {
    accessToken = localStorage.getItem('access_token');
  }
  return accessToken;
}

export function getRefreshToken(): string | null {
  if (!refreshToken) {
    refreshToken = localStorage.getItem('refresh_token');
  }
  return refreshToken;
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}

// Tenant context
let tenantId: string | null = null;

export function setTenantId(id: string) {
  tenantId = id;
  localStorage.setItem('tenant_id', id);
}

export function getTenantId(): string | null {
  if (!tenantId) {
    tenantId = localStorage.getItem('tenant_id');
  }
  return tenantId;
}

// API request helper
export async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${API_URL}${endpoint}`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Add auth token if available
  const token = getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Add tenant header if available
  const tenant = getTenantId();
  if (tenant) {
    headers['X-Tenant-Id'] = tenant;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle token refresh on 401
  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      // Retry original request with new token
      headers['Authorization'] = `Bearer ${accessToken}`;
      return fetch(url, {
        ...options,
        headers,
      });
    }
  }

  return response;
}

// Helper for JSON requests
export async function apiJson<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await apiRequest(endpoint, options);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

// Refresh access token using refresh token
async function refreshAccessToken(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) {
    return false;
  }

  try {
    const response = await fetch(`${API_URL}/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refresh }),
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    setTokens(data.access_token, data.refresh_token);
    return true;
  } catch (error) {
    console.error('Token refresh failed:', error);
    return false;
  }
}

// Convenience methods
export const api = {
  get: <T = any>(endpoint: string) => apiJson<T>(endpoint, { method: 'GET' }),
  
  post: <T = any>(endpoint: string, data?: any) =>
    apiJson<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  patch: <T = any>(endpoint: string, data?: any) =>
    apiJson<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  
  delete: <T = any>(endpoint: string) =>
    apiJson<T>(endpoint, { method: 'DELETE' }),
  
  put: <T = any>(endpoint: string, data?: any) =>
    apiJson<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

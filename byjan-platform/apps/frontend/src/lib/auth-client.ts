/**
 * Auth client for Byjan Business frontend
 * Handles Firebase authentication and token management
 */

import { api, setTokens, clearTokens, getAccessToken } from './api';

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface User {
  id: string;
  firebase_uid: string;
  email?: string;
  phone?: string;
  name?: string;
  lang: string;
  ui: Record<string, any>;
  sup: boolean;
  mfa_enabled: boolean;
  tenants: Array<{
    id: string;
    name: string;
    kind: string;
    role: string;
  }>;
}

// Firebase ID token exchange
export async function exchangeFirebaseToken(idToken: string): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>('/v1/auth/firebase/exchange', {
    id_token: idToken,
  });
  
  setTokens(response.access_token, response.refresh_token);
  return response;
}

// Send OTP
export async function sendOtp(request: {
  channel: 'sms' | 'email' | 'whatsapp';
  identifier: string;
  purpose: 'signin' | 'verify' | 'reset' | 'step_up';
}): Promise<{ status: string }> {
  return api.post('/v1/auth/otp/send', request);
}

// Verify OTP
export async function verifyOtp(request: {
  identifier: string;
  code: string;
  purpose: string;
}): Promise<AuthResponse> {
  return api.post<AuthResponse>('/v1/auth/otp/verify', request);
}

// Refresh token
export async function refreshToken(): Promise<AuthResponse> {
  const refresh_token = localStorage.getItem('refresh_token');
  if (!refresh_token) {
    throw new Error('No refresh token');
  }
  
  const response = await api.post<AuthResponse>('/v1/auth/refresh', {
    refresh_token,
  });
  
  setTokens(response.access_token, response.refresh_token);
  return response;
}

// Logout
export async function logout(): Promise<void> {
  try {
    await api.post('/v1/auth/logout');
  } finally {
    clearTokens();
  }
}

// Get current user
export async function getMe(): Promise<User> {
  return api.get<User>('/v1/me');
}

// Update profile
export async function updateMe(data: {
  name?: string;
  phone?: string;
  avatar_file_id?: string;
  lang?: 'en' | 'te' | 'ta' | 'kn' | 'hi';
  ui?: Record<string, any>;
}): Promise<void> {
  await api.patch('/v1/me', data);
}

// Check if authenticated
export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

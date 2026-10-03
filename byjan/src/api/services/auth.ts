// Auth, onboarding & profile endpoints.
import { api, ApiError, setRefreshToken } from '../client';
import { me } from '../mocks';
import type { User } from '../types';

export const authApi = {
  /** PLACEHOLDER: POST /v1/auth/otp/send — sends a 6-digit SMS OTP. */
  sendOtp: (phone: string) =>
    api<{ requestId: string; resendInSec: number }>('POST', '/v1/auth/otp/send', { body: { phone }, mock: { requestId: 'otp_123', resendInSec: 24 } }),

  /** PLACEHOLDER: POST /v1/auth/otp/verify — returns a session token. Demo code: 246810. */
  verifyOtp: async (requestId: string, code: string) => {
    const r = await api<{ token: string; refreshToken?: string; user: User; isNew: boolean }>('POST', '/v1/auth/otp/verify', {
      body: { requestId, code },
      mock: () => {
        if (code !== '246810') throw new ApiError(400, 'OTP_MISMATCH', "That code didn't match");
        return { token: 'mock-token', user: me, isNew: false };
      },
    });
    if (r.refreshToken) setRefreshToken(r.refreshToken);
    return r;
  },

  /** PLACEHOLDER: POST /v1/auth/oauth/google — exchange a Google ID token for a session. */
  signInWithGoogle: (idToken: string) =>
    api<{ token: string; user: User }>('POST', '/v1/auth/oauth/google', { body: { idToken }, mock: { token: 'mock-token', user: me } }),

  /** PLACEHOLDER: POST /v1/auth/password/forgot — emails a reset link. */
  forgotPassword: (email: string) =>
    api<{ sent: true }>('POST', '/v1/auth/password/forgot', {
      body: { email },
      mock: () => {
        if (email.toLowerCase().startsWith('unknown')) throw new ApiError(404, 'NO_ACCOUNT', 'No Byjan account uses this email. Try your phone number instead.');
        return { sent: true };
      },
    }),

  /** PLACEHOLDER: POST /v1/auth/pin/verify — app-lock PIN check. Demo PIN: 2580. */
  verifyPin: (pin: string) =>
    api<{ ok: boolean; triesLeft: number }>('POST', '/v1/auth/pin/verify', { body: { pin }, delay: 200, mock: { ok: pin === '2580', triesLeft: 4 } }),

  /** PLACEHOLDER: POST /v1/auth/logout */
  logout: () => api<void>('POST', '/v1/auth/logout', { mock: undefined as void }),

  /**
   * PLACEHOLDER: POST /v1/auth/session/unlock — after a successful on-device biometric check
   * (expo-local-authentication `authenticateAsync`), exchange the device-bound key for a fresh session.
   */
  unlockWithBiometrics: (deviceSignature: string) => api<{ token: string }>('POST', '/v1/auth/session/unlock', { body: { deviceSignature }, delay: 200, mock: { token: 'mock-token' } }),

  /** PLACEHOLDER: POST /v1/auth/sessions/revoke-others — "Secure account" from a security alert. */
  revokeOtherSessions: () => api<{ revoked: number }>('POST', '/v1/auth/sessions/revoke-others', { mock: { revoked: 1 } }),
};

export const profileApi = {
  /** PLACEHOLDER: GET /v1/me */
  get: () => api<User>('GET', '/v1/me', { mock: me }),

  /** PLACEHOLDER: PATCH /v1/me — profile setup (name, UPI ID). */
  update: (p: Partial<Pick<User, 'name' | 'upiId' | 'email'>>) => api<User>('PATCH', '/v1/me', { body: p, mock: { ...me, ...p } }),

  /** PLACEHOLDER: PUT /v1/me/preferences — app lock, biometrics, alerts, daily summary. */
  updatePrefs: (prefs: Record<string, boolean>) => api<Record<string, boolean>>('PUT', '/v1/me/preferences', { body: prefs, mock: prefs }),

  /** PLACEHOLDER: POST /v1/upi/validate — resolve a VPA before saving it. */
  validateUpi: (vpa: string) => api<{ valid: boolean; name?: string }>('POST', '/v1/upi/validate', { body: { vpa }, mock: { valid: /^[\w.-]{2,}@[a-z]{2,}$/i.test(vpa), name: 'Arjun Kumar' } }),
};

/** Password rules for new accounts only. Existing passwords are not re-validated on sign-in. */

export const PASSWORD_MIN_LEN = 8;

export type PasswordCheck = {
  ok: boolean;
  message: string;
};

export function checkNewPassword(raw: string): PasswordCheck {
  const password = String(raw || '');
  if (password.length < PASSWORD_MIN_LEN) {
    return { ok: false, message: `Password must be at least ${PASSWORD_MIN_LEN} characters.` };
  }
  if (password.length > 128) {
    return { ok: false, message: 'Password is too long.' };
  }
  if (!/[a-z]/.test(password)) {
    return { ok: false, message: 'Include at least one lowercase letter.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { ok: false, message: 'Include at least one uppercase letter.' };
  }
  if (!/[0-9]/.test(password)) {
    return { ok: false, message: 'Include at least one number.' };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { ok: false, message: 'Include at least one symbol (for example ! @ # $).' };
  }
  if (/\s/.test(password)) {
    return { ok: false, message: 'Password cannot contain spaces.' };
  }
  return { ok: true, message: '' };
}

export const PASSWORD_HINT =
  'Use 8+ characters with upper and lower case, a number, and a symbol.';

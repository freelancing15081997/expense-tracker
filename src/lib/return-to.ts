export function setReturnTo(path: string) {
  const next = sanitizeReturnPath(path);
  try {
    sessionStorage.setItem('byjan.returnTo', next);
  } catch {
    // private mode
  }
}

export function peekReturnTo() {
  try {
    return sanitizeReturnPath(sessionStorage.getItem('byjan.returnTo') || '/');
  } catch {
    return '/';
  }
}

export function consumeReturnTo() {
  const path = peekReturnTo();
  try {
    sessionStorage.removeItem('byjan.returnTo');
  } catch {
    // private mode
  }
  return path;
}

/** Only same-app absolute paths — blocks //evil, https:, javascript:, etc. */
export function sanitizeReturnPath(path: string) {
  const raw = String(path || '').trim() || '/';
  if (!raw.startsWith('/')) return '/';
  if (raw.startsWith('//')) return '/';
  if (raw.includes('://')) return '/';
  if (/[\s\\]/.test(raw)) return '/';
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return '/';
  return raw.slice(0, 512);
}

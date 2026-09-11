export function setReturnTo(path: string) {
  const next = String(path || '').trim() || '/';
  try {
    sessionStorage.setItem('byjan.returnTo', next.startsWith('/') ? next : `/${next}`);
  } catch {
    // private mode
  }
}

export function peekReturnTo() {
  try {
    return sessionStorage.getItem('byjan.returnTo') || '/';
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
  return path.startsWith('/') ? path : '/';
}

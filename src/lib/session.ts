import { logout } from './firebase';
import { clearStoreCache } from './store';

const IDLE_MS = 30 * 60 * 1000;
const MAX_MS = 12 * 60 * 60 * 1000;
const STARTED_KEY = 'byjan.session.started';
const ACTIVE_KEY = 'byjan.session.active';

function now() {
  return Date.now();
}

function read(key: string) {
  try {
    return Number(sessionStorage.getItem(key) || 0);
  } catch {
    return 0;
  }
}

function write(key: string, value: number) {
  try {
    sessionStorage.setItem(key, String(value));
  } catch {
    // private mode
  }
}

export function markSessionActivity() {
  write(ACTIVE_KEY, now());
  if (!read(STARTED_KEY)) write(STARTED_KEY, now());
}

export function clearSessionClock() {
  try {
    sessionStorage.removeItem(STARTED_KEY);
    sessionStorage.removeItem(ACTIVE_KEY);
  } catch {
    // private mode
  }
}

export function sessionExpired() {
  const started = read(STARTED_KEY);
  const active = read(ACTIVE_KEY);
  if (!started || !active) return false;
  const t = now();
  return t - active > IDLE_MS || t - started > MAX_MS;
}

export function startSessionGuard() {
  markSessionActivity();
  const onActivity = () => markSessionActivity();
  const events: Array<keyof WindowEventMap> = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];
  for (const event of events) window.addEventListener(event, onActivity, { passive: true });
  const timer = window.setInterval(() => {
    if (!sessionExpired()) return;
    clearSessionClock();
    clearStoreCache();
    void logout();
  }, 15_000);
  return () => {
    window.clearInterval(timer);
    for (const event of events) window.removeEventListener(event, onActivity);
  };
}

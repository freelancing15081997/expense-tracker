/**
 * User-scoped client caches. Always include uid so account switches never leak data.
 */

const PREFIX = 'byjan.u.';

export function userCacheKey(uid: string, name: string) {
  return `${PREFIX}${uid || 'anon'}.${name}`;
}

export function readUserJson<T>(uid: string, name: string): T | null {
  if (!uid) return null;
  try {
    const raw = sessionStorage.getItem(userCacheKey(uid, name));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeUserJson(uid: string, name: string, value: unknown) {
  if (!uid) return;
  try {
    sessionStorage.setItem(userCacheKey(uid, name), JSON.stringify(value));
  } catch { /* quota / private */ }
}

export function readUserLocalJson<T>(uid: string, name: string): T | null {
  if (!uid) return null;
  try {
    const raw = localStorage.getItem(userCacheKey(uid, name));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeUserLocalJson(uid: string, name: string, value: unknown) {
  if (!uid) return;
  try {
    localStorage.setItem(userCacheKey(uid, name), JSON.stringify(value));
  } catch { /* ignore */ }
}

/** Wipe stored Byjan caches so the next login cannot see prior account data. */
export function clearStoredUserCaches() {
  try {
    const drop = (store: Storage) => {
      const keys: string[] = [];
      for (let i = 0; i < store.length; i += 1) {
        const key = store.key(i);
        if (!key) continue;
        if (
          key.startsWith(PREFIX)
          || key.startsWith('byjan.dash.stats.')
          || key === 'byjan_money_books_cache'
          || key === 'byjan_last_money_book'
          || key === 'byjan_pending_capture'
          || key === 'byjan.dash.books'
          || key.startsWith('byjan.ledger.snap.')
          || key === 'byjan.recent.ledgers'
          || key === 'byjan.store.v1'
        ) {
          keys.push(key);
        }
      }
      keys.forEach((k) => store.removeItem(k));
    };
    drop(sessionStorage);
    drop(localStorage);
  } catch { /* ignore */ }
}

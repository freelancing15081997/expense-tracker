const KEY = 'byjan.financialInbox.v1';

export type InboxState = {
  read: string[];
  dismissed: string[];
};

function loadRaw(uid: string): InboxState {
  try {
    const raw = localStorage.getItem(`${KEY}:${uid}`);
    if (!raw) return { read: [], dismissed: [] };
    const parsed = JSON.parse(raw) as InboxState;
    return {
      read: Array.isArray(parsed.read) ? parsed.read.slice(0, 400) : [],
      dismissed: Array.isArray(parsed.dismissed) ? parsed.dismissed.slice(0, 400) : [],
    };
  } catch {
    return { read: [], dismissed: [] };
  }
}

function saveRaw(uid: string, state: InboxState) {
  try {
    localStorage.setItem(`${KEY}:${uid}`, JSON.stringify(state));
  } catch { /* ignore quota */ }
}

export function readInboxState(uid: string) {
  return loadRaw(uid);
}

export function markInboxRead(uid: string, id: string, read = true) {
  const state = loadRaw(uid);
  const set = new Set(state.read);
  if (read) set.add(id);
  else set.delete(id);
  const next = { ...state, read: [...set] };
  saveRaw(uid, next);
  return next;
}

export function markInboxDismissed(uid: string, ids: string[]) {
  const state = loadRaw(uid);
  const set = new Set(state.dismissed);
  for (const id of ids) set.add(id);
  const next = { ...state, dismissed: [...set] };
  saveRaw(uid, next);
  return next;
}

export function clearInboxState(uid: string) {
  const next = { read: [] as string[], dismissed: [] as string[] };
  saveRaw(uid, next);
  return next;
}

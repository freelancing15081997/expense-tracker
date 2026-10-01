import { Network } from '@capacitor/network';
import { createEntry, type Expense } from './books';
import { ApiError } from './api';

/** Entries created offline wait here and are sent (idempotently) when the network returns. */
type Queued = { key: string; bookId: string; expense: Partial<Expense>; at: number };
const KEY = 'byjan.offlineQueue';
const read = (): Queued[] => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const write = (q: Queued[]) => { try { localStorage.setItem(KEY, JSON.stringify(q)); } catch { /* full */ } };

export const queued = () => read();
export function enqueue(bookId: string, expense: Partial<Expense>, key: string) {
  write([...read().filter((q) => q.key !== key), { key, bookId, expense, at: Date.now() }]);
}

let flushing = false;
export async function flush(onDone?: (n: number) => void) {
  if (flushing) return; flushing = true;
  let sent = 0;
  try {
    for (const q of read()) {
      try {
        await createEntry(q.bookId, q.expense, { idempotencyKey: q.key, force: true });
        write(read().filter((x) => x.key !== q.key)); sent++;
      } catch (e) {
        if (e instanceof ApiError && e.status === 0) break; // still offline
        if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 429) write(read().filter((x) => x.key !== q.key)); // rejected — drop
      }
    }
  } finally { flushing = false; if (sent) onDone?.(sent); }
}

export function startOfflineSync(onDone: (n: number) => void) {
  void flush(onDone);
  const h = Network.addListener('networkStatusChange', (s) => { if (s.connected) void flush(onDone); });
  return () => { void h.then((x) => x.remove()); };
}

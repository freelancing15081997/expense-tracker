import type { ManualFormDraft, ReceiptLaunch } from '../components/ReceiptCaptureFlow';
import { clearPendingCapture } from '../components/ShareIntentListener';

/**
 * One share-reading session for the whole app.
 * The sheet lives above page routes, so a book load or a navigation
 * cannot close it and open a second one.
 */
type Session = {
  launch: ReceiptLaunch;
  fp: string;
};

type Saved = {
  expense: Record<string, unknown>;
  extras?: { count?: number; needsEdit?: boolean; duplicate?: boolean };
  at: number;
};

type ManualHold = {
  bookId: string;
  draft: ManualFormDraft;
  at: number;
};

let session: Session | null = null;
let saved: Saved | null = null;
let manual: ManualHold | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

function fingerprint(launch: ReceiptLaunch) {
  return [
    String(launch.receivedAt || ''),
    String(launch.filePath || ''),
    String(launch.imageDataUrl || '').length,
    String(launch.imageDataUrl || '').slice(64, 128),
    String(launch.text || '').slice(0, 120),
    String(launch.batch?.length || 0),
    String(launch.fileName || ''),
    String(launch.preferredBookId || ''),
  ].join('|');
}

function hasImage(launch: ReceiptLaunch) {
  return String(launch.imageDataUrl || '').length > 64 || (launch.batch?.length || 0) > 0;
}

export function presentShare(launch: ReceiptLaunch) {
  const fp = fingerprint(launch);
  if (session) {
    const sameDoc = Boolean(launch.receivedAt) && session.launch.receivedAt === launch.receivedAt;
    if (sameDoc && !hasImage(session.launch) && hasImage(launch)) {
      session = { launch, fp };
      emit();
    }
    return;
  }
  session = { launch, fp };
  clearPendingCapture();
  emit();
}

export function dismissShare() {
  if (!session) return;
  session = null;
  emit();
}

export function getShareLaunch(): ReceiptLaunch | null {
  return session?.launch ?? null;
}

export function subscribeShare(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function rememberShareSaved(
  expense: Record<string, unknown>,
  extras?: Saved['extras'],
) {
  saved = { expense, extras, at: Date.now() };
}

export function takeShareSaved(bookId: string): Saved | null {
  if (!saved) return null;
  if (Date.now() - saved.at > 12_000) {
    saved = null;
    return null;
  }
  if (String(saved.expense.bookId || '') !== String(bookId || '')) return null;
  const row = saved;
  saved = null;
  return row;
}

export function rememberShareManual(bookId: string, draft: ManualFormDraft) {
  manual = { bookId: String(bookId || ''), draft, at: Date.now() };
}

export function takeShareManual(bookId: string): ManualFormDraft | null {
  if (!manual) return null;
  if (Date.now() - manual.at > 20_000 || manual.bookId !== String(bookId || '')) return null;
  const draft = manual.draft;
  manual = null;
  return draft;
}

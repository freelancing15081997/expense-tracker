import React, { useEffect, useRef } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { listLedgers } from '../lib/ledgers';
import { auth } from '../lib/firebase';
import { readUserLocalJson, writeUserLocalJson } from '../lib/user-cache';
import {
  checkPendingShare,
  onShareReceived,
  resolveSharePayload,
  sharedFileDataUrl,
  type SharedPayload,
} from '../lib/share-receiver';

export type PendingCapture = {
  text?: string;
  imageDataUrl?: string;
  filePath?: string;
  fileName?: string;
  mimeType?: string;
  source: string;
  requireBookPick?: boolean;
  preferredBookId?: string;
  receivedAt: string;
  batch?: Array<{
    imageDataUrl: string;
    fileName?: string;
    mimeType?: string;
    text?: string;
  }>;
};

const STORAGE_KEY = 'byjan_pending_capture';
/** In-memory handoff — avoids sessionStorage size limits for large shares. */
let memoryPending: PendingCapture | null = null;
let booksCacheUid = '';
let booksCache: Array<{ id: string; name: string; currency?: string }> | null = null;

function currentUid() {
  return String(auth.currentUser?.uid || '');
}

function cachedBookId() {
  const uid = currentUid();
  if (!uid) return '';
  const row = readUserLocalJson<{ id?: string }>(uid, 'last_money_book');
  return String(row?.id || '').trim();
}

export function rememberMoneyBook(bookId: string) {
  const uid = currentUid();
  if (!uid || !bookId) return;
  writeUserLocalJson(uid, 'last_money_book', { id: bookId });
}

export function lastMoneyBookId() {
  return cachedBookId();
}

export function cacheMoneyBooks(books: Array<{ id: string; name: string; currency?: string }>) {
  const uid = currentUid();
  booksCacheUid = uid;
  booksCache = books;
  if (!uid) return;
  writeUserLocalJson(uid, 'money_books', { at: Date.now(), books });
}

export function readCachedMoneyBooks() {
  const uid = currentUid();
  if (booksCache?.length && booksCacheUid === uid) return booksCache;
  if (!uid) return [];
  const parsed = readUserLocalJson<{ books?: Array<{ id: string; name: string; currency?: string }> }>(uid, 'money_books');
  if (!Array.isArray(parsed?.books)) return [];
  booksCacheUid = uid;
  booksCache = parsed!.books!;
  return parsed!.books!;
}

export function clearShareCaches() {
  memoryPending = null;
  booksCache = null;
  booksCacheUid = '';
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

function storePending(pending: PendingCapture) {
  memoryPending = pending;
  try {
    const light = {
      ...pending,
      imageDataUrl: pending.imageDataUrl && pending.imageDataUrl.length > 200_000
        ? undefined
        : pending.imageDataUrl,
      _hasImage: Boolean(pending.imageDataUrl),
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(light));
  } catch { /* memory still holds full payload */ }
}

function notifyCaptureReady() {
  try {
    window.dispatchEvent(new CustomEvent('byjan-pending-capture'));
  } catch { /* ignore */ }
}

/**
 * Android share → always show Choose Money book when 2+ books.
 * Pending is kept until Dashboard/BookView consumes it into ReceiptCaptureFlow.
 */
export default function ShareIntentListener() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const lastFp = useRef('');
  const lastAt = useRef(0);

  const routePending = async (pending: PendingCapture) => {
    const receivedAt = String(pending.receivedAt || Date.now());
    // Same native payload can arrive as both the light event and checkPending.
    if (receivedAt && receivedAt === lastFp.current) return;
    lastFp.current = receivedAt;
    lastAt.current = Date.now();

    const deepLinkBook = String(pending.preferredBookId || '').trim();

    // Only a deep-linked bookId may skip the picker. Never use last/open book —
    // that made share look like books were missing / already chosen.
    const preferred = deepLinkBook;
    const requirePick = !deepLinkBook;

    storePending({
      ...pending,
      preferredBookId: preferred || undefined,
      requireBookPick: requirePick,
    });

    const tok = Date.now().toString(36);
    const cachedVisible = readCachedMoneyBooks();
    const onlyCached = !deepLinkBook && cachedVisible.length === 1 ? cachedVisible[0] : null;
    if (!requirePick && preferred) {
      rememberMoneyBook(preferred);
      navigate(`/book/${preferred}?capture=1&s=${tok}`, { replace: false });
    } else if (onlyCached) {
      rememberMoneyBook(onlyCached.id);
      storePending({
        ...pending,
        preferredBookId: onlyCached.id,
        requireBookPick: false,
      });
      navigate(`/book/${onlyCached.id}?capture=1&s=${tok}`, { replace: false });
    } else {
      navigate(`/?capture=1&s=${tok}`, { replace: false });
      window.setTimeout(() => notifyCaptureReady(), 40);
    }

    // Refresh names in the background. Do not navigate or parse again — that
    // restarted the book picker mid-read and the second pass lost the amount.
    void listLedgers().then((books) => {
      const visible = (books || [])
        .filter((b) => b && !b.deleted && !b.deletedAt && !b.archived)
        .map((b) => ({ id: String(b.id), name: String(b.name || 'Money book'), currency: String(b.currency || 'INR') }));
      cacheMoneyBooks(visible);
    }).catch(() => undefined);
  };

  const fromNative = async (payload: SharedPayload) => {
    if (payload.error) {
      addToast(payload.error, 'error');
      return;
    }
    const full = await resolveSharePayload(payload);
    const dataUrl = sharedFileDataUrl(full);
    const text = String(full.text || '').trim();
    const extraFiles = Array.isArray(full.files) ? full.files : [];
    const batch = extraFiles
      .map((file) => {
        const url = sharedFileDataUrl({ ...full, ...file, text: undefined });
        if (!url) return null;
        return {
          imageDataUrl: url,
          fileName: file.fileName || full.fileName,
          mimeType: file.mimeType || full.mimeType,
          text: text || undefined,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
    const filePath = String(full.filePath || extraFiles[0]?.filePath || '').trim();
    if (!dataUrl && !text && !batch.length && !filePath) {
      addToast('Could not read the shared file — try sharing again', 'error');
      return;
    }
    const receivedAt = full.receivedAt
      ? String(full.receivedAt)
      : new Date().toISOString();
    await routePending({
      text: text || undefined,
      imageDataUrl: dataUrl || batch[0]?.imageDataUrl,
      filePath: filePath || undefined,
      fileName: full.fileName || batch[0]?.fileName,
      mimeType: full.mimeType || batch[0]?.mimeType || (dataUrl?.startsWith('data:') ? dataUrl.slice(5).split(';')[0] : undefined),
      source: full.source || 'share',
      receivedAt,
      batch: batch.length > 1 ? batch : undefined,
    });
  };

  useEffect(() => {
    const onInject = (event: Event) => {
      const detail = (event as CustomEvent<Partial<PendingCapture> & { imageDataUrl?: string; text?: string; filePath?: string }>).detail || {};
      if (!detail.imageDataUrl && !detail.text && !detail.batch?.length && !detail.filePath) return;
      lastFp.current = '';
      void routePending({
        text: detail.text,
        imageDataUrl: detail.imageDataUrl,
        filePath: detail.filePath,
        fileName: detail.fileName,
        mimeType: detail.mimeType,
        source: detail.source || 'share',
        preferredBookId: detail.preferredBookId,
        requireBookPick: detail.requireBookPick,
        receivedAt: String(detail.receivedAt || Date.now()),
        batch: detail.batch,
      });
    };
    const onDiscard = () => {
      lastFp.current = '';
      lastAt.current = 0;
      clearPendingCapture();
    };
    window.addEventListener('byjan-inject-capture', onInject);
    window.addEventListener('byjan-capture-discarded', onDiscard);
    return () => {
      window.removeEventListener('byjan-inject-capture', onInject);
      window.removeEventListener('byjan-capture-discarded', onDiscard);
    };
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let removeShare: (() => void) | undefined;
    let urlHandle: { remove: () => Promise<void> } | undefined;
    let alive = true;

    void (async () => {
      const pending = await checkPendingShare();
      if (!alive) return;
      if (pending) await fromNative(pending);
      removeShare = await onShareReceived((payload) => { void fromNative(payload); });
    })();

    const handleUrl = async (url: string) => {
      try {
        const parsed = new URL(url);
        const text = parsed.searchParams.get('text') || parsed.searchParams.get('body') || '';
        const bookId = parsed.searchParams.get('bookId') || '';
        if (!text && !url.includes('capture')) return;
        await routePending({
          text: text || url,
          source: 'share',
          preferredBookId: bookId || undefined,
          receivedAt: new Date().toISOString(),
        });
      } catch { /* ignore */ }
    };

    CapApp.addListener('appUrlOpen', (event) => { void handleUrl(event.url); }).then((handle) => {
      if (!alive) {
        handle.remove().catch(() => undefined);
        return;
      }
      urlHandle = handle;
    }).catch(() => undefined);
    CapApp.getLaunchUrl().then((result) => {
      if (result?.url) void handleUrl(result.url);
    }).catch(() => undefined);

    return () => {
      alive = false;
      removeShare?.();
      urlHandle?.remove().catch(() => undefined);
    };
  }, [navigate, addToast]);

  return null;
}

function receivedAtMs(raw?: string) {
  const s = String(raw || '');
  const n = Number(s);
  if (Number.isFinite(n) && n > 1e11) return n;
  const parsed = Date.parse(s);
  return Number.isFinite(parsed) ? parsed : 0;
}

const PENDING_TTL_MS = 3 * 60 * 1000;

function freshPending(pending: PendingCapture | null): PendingCapture | null {
  if (!pending) return null;
  const at = receivedAtMs(pending.receivedAt);
  if (!at || Date.now() - at > PENDING_TTL_MS) {
    clearPendingCapture();
    return null;
  }
  return pending;
}

export function readPendingCapture(): PendingCapture | null {
  let pending: PendingCapture | null = null;
  if (memoryPending?.imageDataUrl || memoryPending?.text || memoryPending?.filePath || memoryPending?.batch?.length) {
    pending = memoryPending;
  } else {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as PendingCapture & { _hasImage?: boolean };
      // Large shares keep bytes only in memory — if memory was wiped, cannot recover.
      if (!parsed?.text && !parsed?.imageDataUrl && !parsed?.filePath) return null;
      pending = {
        text: parsed.text ? String(parsed.text) : undefined,
        imageDataUrl: parsed.imageDataUrl ? String(parsed.imageDataUrl) : undefined,
        filePath: parsed.filePath ? String(parsed.filePath) : undefined,
        fileName: parsed.fileName ? String(parsed.fileName) : undefined,
        mimeType: parsed.mimeType ? String(parsed.mimeType) : undefined,
        source: String(parsed.source || 'share'),
        requireBookPick: parsed.requireBookPick !== false,
        preferredBookId: parsed.preferredBookId ? String(parsed.preferredBookId) : undefined,
        receivedAt: String(parsed.receivedAt || new Date().toISOString()),
      };
    } catch {
      return null;
    }
  }
  return freshPending(pending);
}

export function clearPendingCapture() {
  memoryPending = null;
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

export function peekPendingCapture(): PendingCapture | null {
  return readPendingCapture();
}

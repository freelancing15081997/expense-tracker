import React, { useEffect, useRef } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { listLedgers } from '../lib/ledgers';
import {
  checkPendingShare,
  onShareReceived,
  sharedFileDataUrl,
  type SharedPayload,
} from '../lib/share-receiver';

export type PendingCapture = {
  text?: string;
  imageDataUrl?: string;
  fileName?: string;
  mimeType?: string;
  source: string;
  requireBookPick?: boolean;
  preferredBookId?: string;
  receivedAt: string;
};

const STORAGE_KEY = 'byjan_pending_capture';
const LAST_BOOK_KEY = 'byjan_last_money_book';
/** In-memory handoff — avoids sessionStorage size limits for large shares. */
let memoryPending: PendingCapture | null = null;

function fingerprint(p: PendingCapture) {
  return [
    p.mimeType || '',
    p.fileName || '',
    (p.imageDataUrl || '').slice(0, 80),
    (p.text || '').slice(0, 80),
  ].join('|');
}

function cachedBookId() {
  try {
    return String(localStorage.getItem(LAST_BOOK_KEY) || '').trim();
  } catch {
    return '';
  }
}

export function rememberMoneyBook(bookId: string) {
  try {
    if (bookId) localStorage.setItem(LAST_BOOK_KEY, bookId);
  } catch { /* ignore */ }
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

/**
 * Listens for Android share intents (image / PDF / Excel / text) and deep links.
 * Navigates immediately; book list loads in parallel so share feels instant.
 */
export default function ShareIntentListener() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const lastFp = useRef('');

  const routePending = async (pending: PendingCapture) => {
    const fp = fingerprint(pending);
    if (fp && fp === lastFp.current) return;
    lastFp.current = fp;
    storePending(pending);

    const last = cachedBookId();
    if (pending.preferredBookId) {
      navigate(`/book/${pending.preferredBookId}?capture=1`, { replace: false });
      addToast('Reading shared file…', 'success');
      void listLedgers().catch(() => undefined);
      return;
    }
    if (last) {
      navigate(`/book/${last}?capture=1`, { replace: false });
      addToast('Reading shared file…', 'success');
      void listLedgers().catch(() => undefined);
      return;
    }

    navigate('/expenses?capture=1', { replace: false });
    addToast('Reading shared file…', 'success');

    const books = await listLedgers().catch(() => []);
    const visible = (books || []).filter((b) => b && !b.deleted && !b.deletedAt && !b.archived);
    if (visible.length === 1) {
      rememberMoneyBook(String(visible[0].id));
      navigate(`/book/${visible[0].id}?capture=1`, { replace: false });
    }
  };

  const fromNative = async (payload: SharedPayload) => {
    if (payload.error) {
      addToast(payload.error, 'error');
      return;
    }
    const dataUrl = sharedFileDataUrl(payload);
    const text = String(payload.text || '').trim();
    if (!dataUrl && !text) return;
    await routePending({
      text: text || undefined,
      imageDataUrl: dataUrl || undefined,
      fileName: payload.fileName,
      mimeType: payload.mimeType || (dataUrl?.startsWith('data:') ? dataUrl.slice(5).split(';')[0] : undefined),
      source: payload.source || 'share',
      requireBookPick: false,
      preferredBookId: cachedBookId() || undefined,
      receivedAt: new Date().toISOString(),
    });
  };

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let removeShare: (() => void) | undefined;
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
          preferredBookId: bookId || cachedBookId() || undefined,
          requireBookPick: !bookId && !cachedBookId(),
          receivedAt: new Date().toISOString(),
        });
      } catch { /* ignore */ }
    };

    CapApp.addListener('appUrlOpen', (event) => { void handleUrl(event.url); }).catch(() => undefined);
    CapApp.getLaunchUrl().then((result) => {
      if (result?.url) void handleUrl(result.url);
    }).catch(() => undefined);

    return () => {
      alive = false;
      removeShare?.();
      CapApp.removeAllListeners().catch(() => undefined);
    };
  }, [navigate, addToast]);

  return null;
}

export function readPendingCapture(): PendingCapture | null {
  if (memoryPending?.imageDataUrl || memoryPending?.text) {
    const out = memoryPending;
    return out;
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingCapture & { _hasImage?: boolean };
    if (!parsed?.text && !parsed?.imageDataUrl) return null;
    return {
      text: parsed.text ? String(parsed.text) : undefined,
      imageDataUrl: parsed.imageDataUrl ? String(parsed.imageDataUrl) : undefined,
      fileName: parsed.fileName ? String(parsed.fileName) : undefined,
      mimeType: parsed.mimeType ? String(parsed.mimeType) : undefined,
      source: String(parsed.source || 'share'),
      requireBookPick: parsed.requireBookPick === true,
      preferredBookId: parsed.preferredBookId ? String(parsed.preferredBookId) : undefined,
      receivedAt: String(parsed.receivedAt || new Date().toISOString()),
    };
  } catch {
    return null;
  }
}

export function clearPendingCapture() {
  memoryPending = null;
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

export function peekPendingCapture(): PendingCapture | null {
  return memoryPending || readPendingCapture();
}

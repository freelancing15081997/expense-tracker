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
/** In-memory handoff — avoids sessionStorage size limits for large shares. */
let memoryPending: PendingCapture | null = null;
let booksCacheUid = '';
let booksCache: Array<{ id: string; name: string; currency?: string }> | null = null;

/** Unique enough across UPI screenshots (same MIME + JPEG header used to collide). */
function fingerprint(p: PendingCapture) {
  const img = p.imageDataUrl || '';
  const mid = img.length > 240 ? img.slice(Math.floor(img.length / 2), Math.floor(img.length / 2) + 64) : '';
  return [
    p.receivedAt || '',
    p.mimeType || '',
    p.fileName || '',
    String(img.length),
    img.slice(0, 24),
    mid,
    img.slice(-48),
    (p.text || '').slice(0, 120),
  ].join('|');
}

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
 * Listens for Android share intents. Always lands on book picker when 2+ books
 * so the user is never stuck auto-saving into the wrong book.
 */
export default function ShareIntentListener() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const lastFp = useRef('');
  const lastAt = useRef(0);

  const routePending = async (pending: PendingCapture) => {
    const fp = fingerprint(pending);
    const now = Date.now();
    // Only drop exact duplicates within 1.5s (double fire from onNewIntent + plugin).
    if (fp && fp === lastFp.current && now - lastAt.current < 1500) return;
    lastFp.current = fp;
    lastAt.current = now;

    const cached = readCachedMoneyBooks();
    const onlyOne = cached.length === 1 ? cached[0] : null;

    // Prefer explicit bookId from deep link; otherwise 1 known book; else always pick.
    // Never auto-use "last book" when 2+ books — user must choose (warm + cold).
    let preferred = pending.preferredBookId || '';
    let requirePick = true;
    if (preferred) {
      requirePick = false;
    } else if (onlyOne) {
      preferred = onlyOne.id;
      requirePick = false;
    }

    storePending({
      ...pending,
      preferredBookId: preferred || undefined,
      requireBookPick: requirePick,
    });
    notifyCaptureReady();

    const tok = Date.now().toString(36);
    if (!requirePick && preferred) {
      rememberMoneyBook(preferred);
      navigate(`/book/${preferred}?capture=1&s=${tok}`, { replace: false });
      addToast('Reading shared file…', 'success');
    } else {
      // Unique query so Dashboard re-opens picker even if already on /expenses.
      navigate(`/expenses?capture=1&s=${tok}`, { replace: false });
      addToast('Choose a Money book…', 'success');
    }

    // Refresh book cache in background for next share.
    void listLedgers().then((books) => {
      const visible = (books || [])
        .filter((b) => b && !b.deleted && !b.deletedAt && !b.archived)
        .map((b) => ({ id: String(b.id), name: String(b.name || 'Money book'), currency: String(b.currency || 'INR') }));
      cacheMoneyBooks(visible);
      if (requirePick && visible.length === 1) {
        rememberMoneyBook(visible[0].id);
        storePending({
          ...pending,
          preferredBookId: visible[0].id,
          requireBookPick: false,
        });
        notifyCaptureReady();
        navigate(`/book/${visible[0].id}?capture=1&s=${Date.now().toString(36)}`, { replace: false });
      }
    }).catch(() => undefined);
  };

  const fromNative = async (payload: SharedPayload) => {
    if (payload.error) {
      addToast(payload.error, 'error');
      return;
    }
    const dataUrl = sharedFileDataUrl(payload);
    const text = String(payload.text || '').trim();
    if (!dataUrl && !text) return;
    const receivedAt = payload.receivedAt
      ? String(payload.receivedAt)
      : new Date().toISOString();
    await routePending({
      text: text || undefined,
      imageDataUrl: dataUrl || undefined,
      fileName: payload.fileName,
      mimeType: payload.mimeType || (dataUrl?.startsWith('data:') ? dataUrl.slice(5).split(';')[0] : undefined),
      source: payload.source || 'share',
      receivedAt,
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
          preferredBookId: bookId || undefined,
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
    return memoryPending;
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
      requireBookPick: parsed.requireBookPick !== false,
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

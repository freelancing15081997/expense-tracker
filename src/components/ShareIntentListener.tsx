import React, { useEffect, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { listLedgers } from '../lib/ledgers';

/**
 * Listens for Android share / deep-link intents carrying text or files.
 * Stores pending capture in sessionStorage for BookView / Capture flow.
 */
export default function ShareIntentListener() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || !Capacitor.isNativePlatform()) return;

    const handleUrl = async (url: string) => {
      try {
        const parsed = new URL(url);
        const text = parsed.searchParams.get('text') || parsed.searchParams.get('body') || '';
        const bookId = parsed.searchParams.get('bookId') || '';
        if (!text && !url.includes('capture')) return;

        const payload = {
          text: text || url,
          source: 'share' as const,
          receivedAt: new Date().toISOString(),
        };
        sessionStorage.setItem('byjan_pending_capture', JSON.stringify(payload));

        if (bookId) {
          navigate(`/book/${bookId}?capture=1`);
          addToast('Shared text ready to review', 'success');
          return;
        }
        const books = await listLedgers();
        const first = books[0];
        if (first?.id) {
          navigate(`/book/${first.id}?capture=1`);
          addToast('Shared text ready — confirm in the money book', 'success');
        } else {
          navigate('/expenses');
          addToast('Open a money book to save the shared capture', 'success');
        }
      } catch {
        /* ignore bad urls */
      }
    };

    CapApp.addListener('appUrlOpen', (event) => {
      void handleUrl(event.url);
    }).catch(() => undefined);

    CapApp.getLaunchUrl().then((result) => {
      if (result?.url) void handleUrl(result.url);
    }).catch(() => undefined);

    return () => {
      CapApp.removeAllListeners().catch(() => undefined);
    };
  }, [ready, navigate, addToast]);

  return null;
}

export function readPendingCapture(): { text: string; source: string } | null {
  try {
    const raw = sessionStorage.getItem('byjan_pending_capture');
    if (!raw) return null;
    sessionStorage.removeItem('byjan_pending_capture');
    const parsed = JSON.parse(raw);
    if (!parsed?.text) return null;
    return { text: String(parsed.text), source: String(parsed.source || 'share') };
  } catch {
    return null;
  }
}

import { apiPost } from './api';
import type { CapturePreview } from './money-core';

export async function parseCaptureText(bookId: string, text: string, source = 'sms') {
  const payload = await apiPost<{ preview?: CapturePreview }>('/api/money', {
    op: 'parseCapture',
    bookId,
    text,
    source,
  });
  return payload.preview || null;
}

export async function saveCaptureEvent(bookId: string, preview: CapturePreview) {
  const payload = await apiPost<{ event?: CapturePreview }>('/api/money', {
    op: 'saveCapture',
    bookId,
    preview,
  });
  return payload.event || preview;
}

export async function confirmCapture(bookId: string, preview: CapturePreview, idempotencyKey?: string) {
  const payload = await apiPost<{ expense?: Record<string, unknown> }>('/api/money', {
    op: 'confirmCapture',
    bookId,
    preview,
    idempotencyKey: idempotencyKey || preview.id,
  });
  return payload.expense || null;
}

export async function nlSearchMoney(bookId: string, query: string) {
  const payload = await apiPost<{ expenses?: Array<Record<string, unknown>>; rows?: Array<Record<string, unknown>> }>('/api/money', {
    op: 'nlSearch',
    bookId,
    query,
  });
  return payload;
}

export async function moneyReportSummary(bookIds: string[], from?: string, to?: string) {
  const payload = await apiPost<{ summary?: Record<string, unknown> }>('/api/money', {
    op: 'reportSummary',
    bookIds,
    from,
    to,
  });
  return payload.summary || null;
}

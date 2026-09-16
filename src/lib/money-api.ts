import { apiPost } from './api';
import type { CapturePreview } from './money-core';
import type { ActivityEvent, MoneyContextOption, MoneySplit } from './money-flow';

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

export async function rankMoneyContexts(hints?: { merchant?: string; category?: string; text?: string }) {
  const payload = await apiPost<{ contexts?: MoneyContextOption[]; autoSelectId?: string | null }>('/api/money', {
    op: 'rankContexts',
    ...hints,
  });
  return {
    contexts: payload.contexts || [],
    autoSelectId: payload.autoSelectId || null,
  };
}

export async function processReceiptJob(input: {
  bookId?: string;
  text?: string;
  receiptPath?: string;
  receiptName?: string;
  source?: string;
  idempotencyKey?: string;
  autoConfirm?: boolean;
  imageBase64?: string;
  imageMime?: string;
  mimeType?: string;
  skipVision?: boolean;
}) {
  return apiPost<{
    flowState?: string;
    copy?: { title: string; detail: string };
    preview?: CapturePreview;
    previews?: CapturePreview[];
    timeline?: ActivityEvent[];
    expense?: Record<string, unknown>;
    autoConfirm?: boolean;
    error?: string;
    idempotent?: boolean;
  }>('/api/money', {
    op: 'processReceipt',
    ...input,
  });
}

export async function saveMoneySplit(bookId: string, expenseId: string, split: MoneySplit & { personSplits?: unknown }) {
  return apiPost<{ split?: MoneySplit; settlements?: unknown[]; toast?: string }>('/api/money', {
    op: 'saveSplit',
    bookId,
    expenseId,
    split,
  });
}

export type MoneySettlementRow = {
  id: string;
  bookId: string;
  expenseId?: string;
  splitId?: string;
  fromUid: string;
  toUid: string;
  amountPaise: number;
  amount?: number;
  currency?: string;
  status: string;
  note?: string;
  merchant?: string;
  expenseDescription?: string;
  receiverUpiSnapshot?: string;
  receiverNameSnapshot?: string;
  createdAt?: string;
  updatedAt?: string;
};

export async function saveMyUpi(input: { upiId: string; upiDisplayName?: string; confirm: boolean }) {
  try {
    return await apiPost<{ profile?: { upiId: string; upiDisplayName: string; upiStatus: string } }>('/api/money', {
      op: 'saveMyUpi',
      ...input,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    // Older production builds may not know saveMyUpi yet — persist via profile upsert.
    if (!/unknown money operation/i.test(msg)) throw err;
    const { upsertMe } = await import('./me');
    const vpa = String(input.upiId || '').trim().toLowerCase();
    if (!input.confirm) throw new Error('Confirm that this UPI ID belongs to you.');
    const user = await upsertMe({
      upiId: vpa,
      upiDisplayName: input.upiDisplayName || undefined,
      upiStatus: 'SELF_CONFIRMED',
      upiConfirmedAt: new Date().toISOString(),
    });
    return {
      profile: {
        upiId: String(user.upiId || vpa),
        upiDisplayName: String(user.upiDisplayName || input.upiDisplayName || ''),
        upiStatus: String(user.upiStatus || 'SELF_CONFIRMED'),
      },
    };
  }
}

export async function listSettlements(bookId: string) {
  try {
    const payload = await apiPost<{ settlements?: MoneySettlementRow[] }>('/api/money', { op: 'listSettlements', bookId });
    return payload.settlements || [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (/unknown money operation/i.test(msg)) return [];
    throw err;
  }
}

export async function listMemberUpi(bookId: string) {
  try {
    const payload = await apiPost<{ members?: Array<{
      uid: string;
      email: string;
      displayName: string;
      upiId: string;
      upiDisplayName: string;
      upiStatus: string;
      hasUpi: boolean;
    }> }>('/api/money', { op: 'listMemberUpi', bookId });
    return payload.members || [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (/unknown money operation/i.test(msg)) return [];
    throw err;
  }
}

export async function requestMemberUpi(bookId: string, targetUid: string, reason?: string) {
  return apiPost('/api/money', { op: 'requestMemberUpi', bookId, targetUid, reason });
}

export async function startUpiPayment(bookId: string, settlementId: string, selectedApp?: string) {
  return apiPost<{
    attemptId?: string;
    settlementId?: string;
    status?: string;
    amountPaise?: number;
    amount?: string;
    upiId?: string;
    recipientName?: string;
    generatedTxnId?: string;
    upiUri?: string;
    prefillOk?: boolean;
    message?: string;
    fallback?: { title: string; upiId: string; amount: string; note: string } | null;
    error?: string;
  }>('/api/money', { op: 'startUpiPayment', bookId, settlementId, selectedApp });
}

export async function reportUpiReturn(input: {
  bookId: string;
  attemptId: string;
  userAction?: 'cancelled' | 'returned' | 'failed' | 'unknown' | 'success' | 'submitted';
  outcome?: 'success' | 'failed' | 'cancelled' | 'submitted' | 'unknown';
  returnedStatus?: string;
  responseCode?: string;
  upiReference?: string;
  raw?: Record<string, unknown>;
}) {
  return apiPost<{ status?: string; message?: string; settlementId?: string }>('/api/money', {
    op: 'reportUpiReturn',
    ...input,
  });
}

export async function confirmSettlementReceived(bookId: string, settlementId: string, note?: string) {
  return apiPost<{ status?: string; settlementId?: string }>('/api/money', {
    op: 'confirmSettlementReceived',
    bookId,
    settlementId,
    note,
  });
}

export async function markSettlementReview(bookId: string, settlementId: string, reason?: string) {
  return apiPost<{ status?: string }>('/api/money', {
    op: 'markSettlementReview',
    bookId,
    settlementId,
    reason,
  });
}

export async function listExpenseTimeline(bookId: string, expenseId?: string) {
  const payload = await apiPost<{ events?: ActivityEvent[] }>('/api/money', {
    op: 'listTimeline',
    bookId,
    expenseId,
  });
  return payload.events || [];
}

export async function getRolePermissions() {
  const payload = await apiPost<{ roles?: Record<string, Record<string, boolean>> }>('/api/money', {
    op: 'getRolePermissions',
  });
  return payload.roles || {};
}

export async function setRolePermissions(roleKey: string, features: Record<string, boolean>) {
  return apiPost('/api/money', {
    op: 'setRolePermissions',
    roleKey,
    features,
  });
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

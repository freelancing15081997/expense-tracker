import { apiPost } from './api';

/** Server-parsed capture (same shape as CapturePreview in the live app, plus richer receipt fields). */
export type CapturePreview = {
  id?: string;
  source: string;
  direction: 'MONEY_OUT' | 'MONEY_IN' | 'TRANSFER' | 'UNKNOWN';
  amountPaise: number;
  description: string;
  merchant?: string;
  category?: string;
  paymentMethod?: string;
  date?: string;
  time?: string;
  upiRef?: string;
  vpa?: string;
  notes?: string;
  fundSource?: string;
  adjustments?: string;
  receiptPath?: string;
  receiptName?: string;
  taxAmount?: number;
  invoiceNumber?: string;
  documentType?: 'receipt' | 'bill' | 'invoice';
  currency?: string;
  accountId?: string;
  txType?: string;
  items?: Array<{ name: string; qty?: number; amount?: number }>;
  processingStatus: string;
  financialStatus: string;
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
  fieldConfidence?: Record<string, number>;
  duplicateOf?: string;
  raw?: string;
};

export type ProcessResult = {
  flowState?: string;
  copy?: { title: string; detail: string };
  preview?: CapturePreview;
  previews?: CapturePreview[];
  expense?: Record<string, unknown>;
  autoSelectBookId?: string | null;
  error?: string;
  idempotent?: boolean;
  usage?: { feature: string; used: number; limit: number };
};

export const parseText = async (bookId: string, text: string, source = 'sms') =>
  (await apiPost<{ preview?: CapturePreview }>('/api/money', { op: 'parseCapture', bookId, text, source })).preview || null;

export const processReceipt = (input: {
  bookId?: string; text?: string; receiptPath?: string; receiptName?: string; source?: string;
  idempotencyKey?: string; imageBase64?: string; imageMime?: string; mimeType?: string; autoConfirm?: boolean;
}) => apiPost<ProcessResult>('/api/money', { op: 'processReceipt', autoConfirm: false, ...input });

export const rankContexts = async (hints: { merchant?: string; category?: string; text?: string }) => {
  const r = await apiPost<{ contexts?: Array<{ id: string; label: string; score?: number }>; autoSelectId?: string | null }>('/api/money', { op: 'rankContexts', ...hints });
  return { contexts: r.contexts || [], autoSelectId: r.autoSelectId || null };
};

/** Tell the server what the person changed so the parser learns (merchant→category rules etc.). */
export const learnCorrection = (bookId: string, captureId: string, before: Record<string, unknown>, after: Record<string, unknown>) =>
  apiPost('/api/money', { op: 'learnCorrection', bookId, captureId, before, after }).catch(() => undefined);

export const nlSearch = (bookId: string, query: string) => apiPost<{ expenses?: Array<Record<string, unknown>> }>('/api/money', { op: 'nlSearch', bookId, query });
export const reportSummary = async (bookIds: string[], from?: string, to?: string) =>
  (await apiPost<{ summary?: ReportSummary }>('/api/money', { op: 'reportSummary', bookIds, from, to })).summary || null;
export type ReportSummary = {
  inPaise: number; outPaise: number; count: number;
  byCategory: Array<{ category: string; outPaise: number }>;
  byMonth: Array<{ month: string; inPaise: number; outPaise: number }>;
  byMethod?: Array<{ method: string; outPaise: number }>;
  topMerchants?: Array<{ merchant: string; outPaise: number; count: number }>;
};
export const listTimeline = async (bookId: string, expenseId?: string) =>
  (await apiPost<{ events?: Array<{ id: string; at: string; actor?: string; action: string; detail?: string }> }>('/api/money', { op: 'listTimeline', bookId, expenseId })).events || [];

// ---- Splits & settlements ----
export type SplitMethod = 'equal' | 'exact' | 'percent' | 'shares';
export type SplitPart = { uid: string; name: string; sharePaise: number; value?: number };
export const saveSplit = (bookId: string, expenseId: string, split: { method: SplitMethod; paidByUid: string; parts: SplitPart[] }) =>
  apiPost<{ toast?: string }>('/api/money', { op: 'saveSplit', bookId, expenseId, split: { ...split, personSplits: split.parts } });
export type Settlement = {
  id: string; bookId: string; expenseId?: string; fromUid: string; toUid: string; amountPaise: number; status: string;
  merchant?: string; expenseDescription?: string; receiverUpiSnapshot?: string; receiverNameSnapshot?: string; createdAt?: string;
};
export const listSettlements = async (bookId: string) => (await apiPost<{ settlements?: Settlement[] }>('/api/money', { op: 'listSettlements', bookId })).settlements || [];
export const listMySettlements = async () => (await apiPost<{ settlements?: Settlement[] }>('/api/money', { op: 'listMySettlements' })).settlements || [];
export const listMemberUpi = async (bookId: string) =>
  (await apiPost<{ members?: Array<{ uid: string; email: string; displayName: string; upiId: string; hasUpi: boolean }> }>('/api/money', { op: 'listMemberUpi', bookId })).members || [];
export const requestMemberUpi = (bookId: string, targetUid: string) => apiPost('/api/money', { op: 'requestMemberUpi', bookId, targetUid });
export const saveMyUpi = (upiId: string, upiDisplayName: string) => apiPost('/api/money', { op: 'saveMyUpi', upiId, upiDisplayName, confirm: true });
export const startUpiPayment = (bookId: string, settlementId: string, selectedApp?: string) =>
  apiPost<{ attemptId?: string; upiUri?: string; amount?: string; upiId?: string; recipientName?: string; fallback?: { upiId: string; amount: string; note: string } | null }>(
    '/api/money', { op: 'startUpiPayment', bookId, settlementId, selectedApp });
export const reportUpiReturn = (bookId: string, attemptId: string, outcome: 'success' | 'failed' | 'cancelled' | 'submitted' | 'unknown', upiReference?: string) =>
  apiPost<{ status?: string; message?: string }>('/api/money', { op: 'reportUpiReturn', bookId, attemptId, outcome, userAction: outcome, upiReference });
export const confirmReceived = (bookId: string, settlementId: string) => apiPost('/api/money', { op: 'confirmSettlementReceived', bookId, settlementId });
export const markReview = (bookId: string, settlementId: string, reason: string) => apiPost('/api/money', { op: 'markSettlementReview', bookId, settlementId, reason });

// ---- Financial inbox (captures waiting for review) ----
export type InboxItem = { id: string; bookId: string; bookName?: string; preview: CapturePreview; kind: 'review' | 'duplicate' | 'upcoming' | 'failed'; at: string };
export const listInbox = async () => (await apiPost<{ items?: InboxItem[] }>('/api/money', { op: 'listInbox' })).items || [];
export const dismissInbox = (id: string) => apiPost('/api/money', { op: 'dismissInbox', id });

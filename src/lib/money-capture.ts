import { parseBankSms, enrichCapture } from './bridge-automations';
import { parseQuickLine, isoDay } from './ledger-advanced';
import { extractReceiptDate } from './amount-parse';
import { classifyCapture } from './money-intelligence';
import {
  type CapturePreview,
  type CaptureDirection,
  type FinancialStatus,
  type ProcessingStatus,
  toPaise,
  newMoneyId,
} from './money-core';
import type { CategoryRule } from './ledger-advanced';
import type { UserMoneyRule } from './money-core';
import type { ExpenseRow } from './money-reports';

function directionFromEntry(entryType?: string): CaptureDirection {
  const t = String(entryType || 'out').toLowerCase();
  if (t === 'in') return 'MONEY_IN';
  if (t === 'transfer') return 'TRANSFER';
  if (t === 'out') return 'MONEY_OUT';
  return 'UNKNOWN';
}

export function buildCapturePreview(
  raw: string,
  source: CapturePreview['source'] = 'sms',
  history: ExpenseRow[] = [],
  bookRules: CategoryRule[] = [],
  userRules: UserMoneyRule[] = [],
): CapturePreview {
  const text = String(raw || '').trim();
  const parsed = parseBankSms(text) || parseQuickLine(text);
  const reasons: string[] = [];

  if (!parsed || !parsed.amount) {
    return {
      source,
      direction: 'UNKNOWN',
      amountPaise: 0,
      description: text.slice(0, 120) || 'Needs review',
      processingStatus: 'REVIEW_REQUIRED',
      financialStatus: 'DRAFT',
      confidence: 'low',
      reasons: ['Could not read amount — please confirm manually'],
      raw: text,
    };
  }

  let draft: Record<string, unknown> = {
    amount: parsed.amount,
    description: parsed.description || parsed.merchant || 'Entry',
    merchant: parsed.merchant || '',
    category: 'Uncategorized',
    entryType: parsed.entryType || 'out',
    paymentMethod: parsed.paymentMethod || 'cash',
    date: parsed.date || isoDay(),
    upiRef: (parsed as { upiRef?: string }).upiRef || '',
    vpa: (parsed as { vpa?: string }).vpa || '',
    source,
  };

  draft = enrichCapture(draft, history);
  const classified = classifyCapture(draft, bookRules, userRules, history);
  draft = classified.draft;
  reasons.push(...classified.reasons);

  let processingStatus: ProcessingStatus = 'READY';
  let confidence: CapturePreview['confidence'] = classified.confidence.level;
  if (!draft.amount || Number(draft.amount) <= 0) {
    processingStatus = 'REVIEW_REQUIRED';
    confidence = 'low';
    reasons.push('Amount missing or zero');
  } else if (draft.flagged) {
    processingStatus = 'REVIEW_REQUIRED';
    confidence = 'medium';
    reasons.push(String(draft.flagReason || 'Flagged for review'));
  } else if (!draft.category || String(draft.category).toLowerCase() === 'uncategorized') {
    confidence = confidence === 'high' ? 'medium' : confidence;
    reasons.push('Category not confirmed');
  } else if (classified.confidence.level === 'low') {
    processingStatus = 'REVIEW_REQUIRED';
  }

  return {
    id: newMoneyId('cap'),
    source,
    direction: directionFromEntry(String(draft.entryType)),
    amountPaise: toPaise(draft.amount),
    description: String(draft.description || ''),
    merchant: String(draft.merchant || ''),
    category: String(draft.category || 'Uncategorized'),
    paymentMethod: String(draft.paymentMethod || 'cash'),
    date: String(draft.date || isoDay()),
    upiRef: String(draft.upiRef || ''),
    vpa: String(draft.vpa || ''),
    notes: String(draft.notes || ''),
    processingStatus,
    financialStatus: 'DRAFT' as FinancialStatus,
    confidence,
    reasons,
    raw: text,
  };
}

export function ensurePreviewCategory(preview: CapturePreview, history: ExpenseRow[] = [], bookRules: CategoryRule[] = [], userRules: UserMoneyRule[] = []): CapturePreview {
  const draft: Record<string, unknown> = {
    amount: preview.amountPaise / 100,
    description: preview.description,
    merchant: preview.merchant,
    category: preview.category || 'Uncategorized',
    entryType: preview.direction === 'MONEY_IN' ? 'in' : preview.direction === 'TRANSFER' ? 'transfer' : 'out',
    paymentMethod: preview.paymentMethod,
    notes: preview.notes,
    raw: preview.raw,
    date: preview.date,
    upiRef: preview.upiRef,
    vpa: preview.vpa,
  };
  const enriched = enrichCapture(draft, history as Array<Record<string, unknown>>);
  const needsCat = !String(preview.category || '').trim() || String(preview.category).toLowerCase() === 'uncategorized';
  const classified = needsCat
    ? classifyCapture(enriched, bookRules, userRules, history)
    : { draft: enriched, reasons: [] as string[] };
  const ocrDate = preview.raw ? extractReceiptDate(preview.raw) : '';
  const currentDate = String(preview.date || classified.draft.date || '');
  const date = (ocrDate && (!currentDate || currentDate === isoDay())) ? ocrDate : (currentDate || ocrDate || isoDay());
  return {
    ...preview,
    merchant: String(classified.draft.merchant || preview.merchant || ''),
    category: String(classified.draft.category || preview.category || 'Uncategorized'),
    paymentMethod: String(classified.draft.paymentMethod || preview.paymentMethod || 'cash'),
    date,
    upiRef: String(classified.draft.upiRef || preview.upiRef || ''),
    vpa: String(classified.draft.vpa || preview.vpa || ''),
    description: String(preview.description || classified.draft.description || preview.merchant || ''),
    reasons: [...(preview.reasons || []), ...classified.reasons].slice(0, 8),
  };
}

export function capturePreviewToExpense(preview: CapturePreview, extras: Record<string, unknown> = {}) {
  const ready = ensurePreviewCategory(preview);
  const entryType = ready.direction === 'MONEY_IN' ? 'in' : ready.direction === 'TRANSFER' ? 'transfer' : 'out';
  const paidDate = String(ready.date || isoDay()).slice(0, 10);
  return {
    amount: ready.amountPaise / 100,
    description: ready.description,
    merchant: ready.merchant,
    category: ready.category,
    entryType,
    paymentMethod: ready.paymentMethod,
    // Transaction / receipt paid date — separate from record createdAt (set by server on save).
    date: paidDate,
    paidAt: paidDate,
    upiRef: ready.upiRef,
    vpa: ready.vpa,
    notes: ready.notes,
    captureId: ready.id,
    captureSource: ready.source,
    processingStatus: ready.processingStatus,
    financialStatus: 'CONFIRMED',
    status: ready.amountPaise > 0 ? 'recorded' : 'draft',
    ...extras,
  };
}

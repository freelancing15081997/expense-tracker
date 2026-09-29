import { extractReceiptDate } from './amount-parse';
import type { CapturePreview } from './money-core';
import { newMoneyId, toPaise } from './money-core';
import { isoDay } from './ledger-advanced';
import { guessCategoryFromText } from './bridge-automations';
import {
  amountIsTransactionReady,
  receiptName,
  receiptTextIsGarbage,
  resolveReceiptText,
  summarizeReceiptMeaning,
} from './receipt-resolve';

export { amountIsTransactionReady, resolveReceiptText, summarizeReceiptMeaning } from './receipt-resolve';

const GENERIC_DESC = /^(shared receipt|receipt|inbound document|inbound email|needs review|entry)$/i;

export function previewFromReceiptText(
  text: string,
  extra: Partial<CapturePreview> = {},
): CapturePreview {
  const raw = String(text || '');
  const resolved = resolveReceiptText(raw);
  const merchant = receiptName(resolved);
  const description = summarizeReceiptMeaning(resolved);
  const amount = resolved.amount;
  const category = guessCategoryFromText(merchant, description, raw) || 'Uncategorized';
  const amountPaise = Number(extra.amountPaise || 0) > 0 ? Number(extra.amountPaise) : (amount > 0 ? toPaise(amount) : 0);
  return {
    ...extra,
    id: extra.id || newMoneyId('cap'),
    source: extra.source || 'share',
    direction: extra.direction || (resolved.direction === 'money_in' ? 'MONEY_IN' : 'MONEY_OUT'),
    amountPaise,
    merchant: extra.merchant || merchant,
    description: extra.description || description,
    category: extra.category || (category === 'Food' ? 'Meals' : category),
    paymentMethod: extra.paymentMethod || (/\b(upi|gpay|google\s*pay|phonepe|paytm|bhim)\b/i.test(raw) ? 'upi' : 'cash'),
    date: extra.date || extractReceiptDate(raw) || isoDay(),
    processingStatus: extra.processingStatus || (amountPaise > 0 ? 'READY' : 'REVIEW_REQUIRED'),
    financialStatus: extra.financialStatus || 'DRAFT',
    confidence: extra.confidence || (amountIsTransactionReady(resolved) ? 'high' : (amountPaise > 0 ? 'medium' : 'low')),
    reasons: extra.reasons || [],
    raw: extra.raw || raw,
  };
}

/** Overlay OCR/share text onto a preview so name / amount / description always come from the receipt. */
export function overlayReceiptFields(preview: CapturePreview, text: string): CapturePreview {
  const raw = String(text || preview.raw || '').trim();
  if (!raw || receiptTextIsGarbage(raw)) {
    const desc = String(preview.description || '').trim();
    return {
      ...preview,
      amountPaise: receiptTextIsGarbage(raw) ? 0 : Number(preview.amountPaise || 0),
      merchant: receiptTextIsGarbage(raw) ? '' : preview.merchant,
      description: GENERIC_DESC.test(desc) || /\.(jpe?g|png|webp|heic|pdf)$/i.test(desc) ? '' : desc,
      processingStatus: receiptTextIsGarbage(raw) ? 'REVIEW_REQUIRED' : preview.processingStatus,
      raw: raw.slice(0, 8000) || preview.raw,
    };
  }
  const mapped = previewFromReceiptText(raw, {
    source: preview.source,
    receiptPath: preview.receiptPath,
    receiptName: preview.receiptName,
    date: preview.date,
    paymentMethod: preview.paymentMethod,
  });
  const amountPaise = mapped.amountPaise > 0 ? mapped.amountPaise : Number(preview.amountPaise || 0);
  const merchant = mapped.merchant || preview.merchant || '';
  const description = mapped.description || '';
  return {
    ...preview,
    ...mapped,
    amountPaise,
    merchant,
    description,
    direction: mapped.direction || preview.direction,
    raw: raw.slice(0, 8000),
    receiptPath: preview.receiptPath || mapped.receiptPath,
    receiptName: preview.receiptName || mapped.receiptName,
    processingStatus: amountPaise > 0 ? 'READY' : 'REVIEW_REQUIRED',
    financialStatus: preview.financialStatus || 'DRAFT',
  };
}

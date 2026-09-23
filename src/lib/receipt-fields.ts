/**
 * Client field mapper — same rules as inbound email (`api/_lib/receipt-fields.ts`).
 * Local share / attach runs this against OCR / PDF / share text so category,
 * description, paid-for, fund source, and notes fill the same way as cloud email.
 */

export {
  type ParsedReceipt,
  CATEGORY_RULES,
  toNumber,
  parseIsoDate,
  clipQuoted,
  stripHtml,
  cleanSubject,
  parseAmount,
  categoryFromText,
  merchantFrom,
  entryTypeFrom,
  documentTypeFrom,
  paymentMethodFrom,
  fundSourceFrom,
  paidForFrom,
  adjustmentsFrom,
  composeNotes,
  summarizeEmailIntent,
  parseReceiptFields,
} from '../../api/_lib/receipt-fields';

import { composeNotes, parseReceiptFields } from '../../api/_lib/receipt-fields';
import type { CapturePreview } from './money-core';
import { guessCategoryFromText } from './bridge-automations';

export const RECEIPT_FILE_ACCEPT = [
  'image/*',
  'application/pdf',
  '.pdf',
  '.csv',
  '.xlsx',
  '.xls',
  '.doc',
  '.docx',
  '.txt',
  '.rtf',
  '.gif',
  '.heic',
  '.heif',
  'text/csv',
  'text/plain',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
].join(',');

const GENERIC_DESC = /^(shared receipt|receipt|inbound document|inbound email|needs review)$/i;

export function enrichPreviewFromText(
  preview: CapturePreview,
  text: string,
  extras?: { fileName?: string; subject?: string },
): CapturePreview {
  const hay = [text, preview.raw, extras?.fileName, extras?.subject].filter(Boolean).join('\n');
  if (!String(hay || '').replace(/\s+/g, '')) return preview;
  const parsed = parseReceiptFields(hay, extras);
  const amountPaise = Number(preview.amountPaise || 0) > 0
    ? Number(preview.amountPaise)
    : Math.round(Number(parsed.amount || 0) * 100);
  const merchant = String(preview.merchant || parsed.merchant || '').trim();
  const existingDesc = String(preview.description || '').trim();
  const merchantAsDesc = Boolean(existingDesc && merchant && existingDesc.toLowerCase() === merchant.toLowerCase());
  const preferParsed = GENERIC_DESC.test(existingDesc) || merchantAsDesc || !existingDesc;
  const paidFor = String(parsed.description || '').trim();
  const description = preferParsed
    ? (paidFor || existingDesc || merchant)
    : (paidFor && paidFor.toLowerCase() !== merchant.toLowerCase() ? paidFor : (existingDesc || paidFor || merchant));
  const guessed = guessCategoryFromText(merchant, description, parsed.notes, hay);
  const guessedNorm = guessed === 'Food' ? 'Meals' : guessed;
  const parsedCat = parsed.category && parsed.category !== 'Uncategorized' ? parsed.category : '';
  const previewCat = preview.category && preview.category !== 'Uncategorized' ? preview.category : '';
  const category = guessedNorm || parsedCat || previewCat || 'Uncategorized';
  const notes = composeNotes([preview.notes, parsed.notes]);
  const today = new Date().toISOString().slice(0, 10);
  const date = (preview.date && preview.date !== today)
    ? preview.date
    : (parsed.date || preview.date || today);
  return {
    ...preview,
    amountPaise,
    merchant,
    description: String(description || '').slice(0, 140),
    category,
    paymentMethod: (preview.paymentMethod && preview.paymentMethod !== 'cash')
      ? preview.paymentMethod
      : (parsed.paymentMethod || preview.paymentMethod || 'cash'),
    date,
    notes: notes || preview.notes,
    fundSource: preview.fundSource || parsed.fundSource,
    adjustments: preview.adjustments || parsed.adjustments,
    direction: preview.direction === 'MONEY_IN' || preview.direction === 'TRANSFER'
      ? preview.direction
      : (parsed.entryType === 'in' ? 'MONEY_IN' : (preview.direction || 'MONEY_OUT')),
  };
}

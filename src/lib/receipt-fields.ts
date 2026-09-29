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
import { overlayReceiptFields } from './receipt-ui';

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
const FILE_LABEL = /\.(jpe?g|png|webp|heic|pdf)$/i;

export function enrichPreviewFromText(
  preview: CapturePreview,
  text: string,
  extras?: { fileName?: string; subject?: string },
): CapturePreview {
  const mapped = overlayReceiptFields(preview, String(text || preview.raw || ''));
  const hay = [text, mapped.raw].filter(Boolean).join('\n');
  if (!String(hay || '').replace(/\s+/g, '')) return mapped;
  const parsed = parseReceiptFields(hay, extras);
  const amountPaise = Number(mapped.amountPaise || 0) > 0
    ? Number(mapped.amountPaise)
    : Math.round(Number(parsed.amount || 0) * 100);
  const merchant = String(mapped.merchant || parsed.merchant || '').trim();
  const existingDesc = String(mapped.description || '').trim();
  const paidFor = String(parsed.description || '').trim();
  const paidForIsGeneric = !paidFor || GENERIC_DESC.test(paidFor) || FILE_LABEL.test(paidFor)
    || (merchant && paidFor.toLowerCase() === merchant.toLowerCase());
  const description = existingDesc && !GENERIC_DESC.test(existingDesc) && !FILE_LABEL.test(existingDesc)
    ? existingDesc
    : (!paidForIsGeneric ? paidFor : existingDesc);
  const guessed = guessCategoryFromText(merchant, description, parsed.notes, hay);
  const guessedNorm = guessed === 'Food' ? 'Meals' : guessed;
  const parsedCat = parsed.category && parsed.category !== 'Uncategorized' ? parsed.category : '';
  const previewCat = mapped.category && mapped.category !== 'Uncategorized' ? mapped.category : '';
  const category = guessedNorm || parsedCat || previewCat || 'Uncategorized';
  const notes = composeNotes([mapped.notes, parsed.notes]);
  const today = new Date().toISOString().slice(0, 10);
  const date = (mapped.date && mapped.date !== today)
    ? mapped.date
    : (parsed.date || mapped.date || today);
  return {
    ...mapped,
    amountPaise,
    merchant,
    description: String(description || '').slice(0, 140),
    category,
    paymentMethod: (mapped.paymentMethod && mapped.paymentMethod !== 'cash')
      ? mapped.paymentMethod
      : (parsed.paymentMethod || mapped.paymentMethod || 'cash'),
    date,
    notes: notes || mapped.notes,
    fundSource: mapped.fundSource || parsed.fundSource,
    adjustments: mapped.adjustments || parsed.adjustments,
    direction: mapped.direction === 'MONEY_IN' || mapped.direction === 'TRANSFER'
      ? mapped.direction
      : (parsed.entryType === 'in' ? 'MONEY_IN' : (mapped.direction || 'MONEY_OUT')),
  };
}

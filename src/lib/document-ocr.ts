/**
 * Local document OCR + deterministic amount parse.
 * Native ML Kit first; Gemini remains server-side fallback for hard cases.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';

type DocumentOcrPlugin = {
  recognizeBase64(opts: { base64: string; mimeType?: string }): Promise<{ text?: string; engine?: string }>;
};

const DocumentOcr = registerPlugin<DocumentOcrPlugin>('DocumentOcr');

export type LocalReceiptParse = {
  text: string;
  engine: string;
  amount: number;
  merchant: string;
  description: string;
  paymentMethod: string;
  entryType: 'in' | 'out';
  date: string;
  confidence: 'high' | 'medium' | 'low';
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/** Extract rupee / INR amounts from UPI screenshots, SMS, and receipt OCR. */
export function parseUpiAmountFromText(text: string): LocalReceiptParse | null {
  const raw = String(text || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  if (!raw) return null;

  const candidates: number[] = [];
  const patterns = [
    /(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/gi,
    /([\d,]+(?:\.\d{1,2})?)\s*(?:₹|rs\.?|inr)\b/gi,
    /(?:paid|sent|debited|spent|total|amount|amt|grand\s*total|net\s*payable|you\s*paid)\s*[:\-]?\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)/gi,
    /(?:debited by|credited by|payment of)\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)/gi,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    const clone = new RegExp(re.source, re.flags);
    while ((m = clone.exec(raw)) !== null) {
      const n = Number(String(m[1] || '').replace(/,/g, ''));
      if (Number.isFinite(n) && n >= 1 && n < 100_000_000) candidates.push(n);
    }
  }

  // Prefer amounts that look like payment totals (not UPI refs / phone fragments).
  const plausible = candidates.filter((n) => n < 5_000_000 && !(n >= 1e10));
  if (!plausible.length) return null;
  // UPI screens usually show one dominant total — take the max among plausible.
  const amount = Math.max(...plausible);

  const inMatch = /\b(?:credited|received|refund|money in|salary)\b/i.test(raw);
  const outMatch = /\b(?:debited|paid|spent|sent to|money out|payment successful)\b/i.test(raw);
  let entryType: 'in' | 'out' = 'out';
  if (inMatch && !outMatch) entryType = 'in';

  const merchant =
    raw.match(/\b(?:to|paid to|sent to|at|from|received from)\s+([A-Za-z0-9 .&'@_-]{2,48})/i)?.[1]?.trim()
    || raw.match(/\b(?:merchant|payee|vpa)\s*[:\-]?\s*([A-Za-z0-9 .@_-]{2,48})/i)?.[1]?.trim()
    || '';

  const paymentMethod = /\bupi\b|@ok|@ybl|@axl|@ibl|gpay|phonepe|paytm/i.test(raw)
    ? 'upi'
    : /\bcard\b|visa|mastercard/i.test(raw)
      ? 'card'
      : /\bbank|neft|imps|rtgs\b/i.test(raw)
        ? 'bank'
        : 'cash';

  const confidence: LocalReceiptParse['confidence'] =
    /(₹|rs\.?|inr)/i.test(raw) && amount > 0 ? 'high' : amount > 0 ? 'medium' : 'low';

  return {
    text: raw.slice(0, 4000),
    engine: 'local-rules',
    amount,
    merchant: merchant.slice(0, 120),
    description: (merchant || raw.slice(0, 80)).slice(0, 200),
    paymentMethod,
    entryType,
    date: todayIso(),
    confidence,
  };
}

export async function recognizeDocumentText(base64: string, mimeType = 'image/jpeg'): Promise<{ text: string; engine: string }> {
  const clean = String(base64 || '').replace(/^data:[^;]+;base64,/i, '').replace(/\s+/g, '');
  if (!clean || clean.length < 64) return { text: '', engine: 'empty' };

  if (Capacitor.isNativePlatform()) {
    try {
      const result = await DocumentOcr.recognizeBase64({ base64: clean, mimeType });
      return {
        text: String(result?.text || '').trim(),
        engine: String(result?.engine || 'mlkit'),
      };
    } catch {
      return { text: '', engine: 'mlkit-failed' };
    }
  }
  return { text: '', engine: 'web-skip' };
}

/** OCR image then deterministically parse amount / merchant. */
export async function localParseReceiptImage(
  base64: string,
  mimeType = 'image/jpeg',
  hintText = '',
): Promise<LocalReceiptParse | null> {
  const fromHint = parseUpiAmountFromText(hintText);
  const ocr = await recognizeDocumentText(base64, mimeType);
  const fromOcr = parseUpiAmountFromText(ocr.text);
  const best = (fromOcr?.amount || 0) >= (fromHint?.amount || 0) ? fromOcr : fromHint;
  if (!best || !(best.amount > 0)) {
    if (ocr.text) {
      return {
        text: ocr.text.slice(0, 4000),
        engine: ocr.engine,
        amount: 0,
        merchant: '',
        description: 'Shared receipt',
        paymentMethod: 'upi',
        entryType: 'out',
        date: todayIso(),
        confidence: 'low',
      };
    }
    return fromHint;
  }
  return {
    ...best,
    text: [hintText, ocr.text].filter(Boolean).join('\n').slice(0, 4000),
    engine: ocr.engine === 'mlkit' ? 'mlkit+rules' : best.engine,
    confidence: ocr.engine === 'mlkit' && best.amount > 0 ? 'high' : best.confidence,
  };
}

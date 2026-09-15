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

type AmtHit = { amount: number; score: number };

/** Extract rupee / INR amounts from UPI screenshots, SMS, and receipt OCR. */
export function parseUpiAmountFromText(text: string): LocalReceiptParse | null {
  const raw = String(text || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  if (!raw) return null;

  const hits: AmtHit[] = [];
  const push = (n: number, score: number) => {
    if (!Number.isFinite(n) || n < 1 || n >= 5_000_000) return;
    // Skip likely years / ref fragments.
    if (n >= 1900 && n <= 2100 && Number.isInteger(n)) return;
    hits.push({ amount: n, score });
  };

  const addMatches = (re: RegExp, score: number) => {
    const clone = new RegExp(re.source, re.flags);
    let m: RegExpExecArray | null;
    while ((m = clone.exec(raw)) !== null) {
      const n = Number(String(m[1] || '').replace(/,/g, ''));
      push(n, score + (/\.\d{1,2}$/.test(String(m[1] || '')) ? 8 : 0));
    }
  };

  addMatches(/(?:paid|you paid|sent|debited|spent|total|amount|amt|grand\s*total|net\s*payable)\s*[:\-]?\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)/gi, 40);
  addMatches(/(?:debited by|credited by|payment of|payment successful)\s*[:\-]?\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)/gi, 38);
  addMatches(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/gi, 30);
  addMatches(/([\d,]+(?:\.\d{1,2})?)\s*(?:₹|rs\.?|inr)\b/gi, 28);

  if (!hits.length) {
    const loose = raw.match(/\b([\d,]{2,}(?:\.\d{1,2})?)\b/g) || [];
    for (const token of loose) {
      const n = Number(token.replace(/,/g, ''));
      // Prefer typical UPI spend range when no currency marker.
      if (n >= 10 && n <= 200_000) push(n, 5);
    }
  }

  if (!hits.length) return null;
  hits.sort((a, b) => b.score - a.score || b.amount - a.amount);
  const amount = hits[0].amount;
  const bestScore = hits[0].score;

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
    bestScore >= 30 ? 'high' : bestScore >= 10 ? 'medium' : 'low';

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

/** Light resize for OCR only — keep digits sharp (separate from upload compress). */
export async function prepareOcrImage(dataUrl: string, mimeType = 'image/jpeg'): Promise<{ base64: string; mime: string }> {
  const fallback = () => ({
    base64: String(dataUrl || '').replace(/^data:[^;]+;base64,/i, '').replace(/\s+/g, ''),
    mime: mimeType.startsWith('image/') ? mimeType : 'image/jpeg',
  });
  if (typeof document === 'undefined' || !mimeType.startsWith('image/')) return fallback();
  try {
    const src = dataUrl.startsWith('data:') ? dataUrl : `data:${mimeType};base64,${dataUrl}`;
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('ocr image'));
      el.src = src;
    });
    const maxEdge = 1600;
    const scale = Math.min(1, maxEdge / Math.max(img.width, img.height, 1));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return fallback();
    ctx.drawImage(img, 0, 0, w, h);
    const next = canvas.toDataURL('image/jpeg', 0.88);
    return {
      base64: next.replace(/^data:[^;]+;base64,/i, ''),
      mime: 'image/jpeg',
    };
  } catch {
    return fallback();
  }
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
    confidence: ocr.engine === 'mlkit' && best.confidence !== 'low' ? 'high' : best.confidence,
  };
}

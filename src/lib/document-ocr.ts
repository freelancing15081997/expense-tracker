/**
 * Local document OCR + deterministic amount parse.
 * Native PP-OCRv4 (Paddle-Lite) first on Android; ML Kit fallback; no Gemini on share.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';
import { extractMoneyAmount, preferMoneyParse, type ParsedMoneyAmount } from './amount-parse';

type DocumentOcrPlugin = {
  recognizeBase64(opts: { base64: string; mimeType?: string }): Promise<{
    text?: string;
    /** Second engine's read of the same page (ML Kit when PP-OCRv4 was primary). */
    altText?: string;
    engine?: string;
    wallMs?: number;
  }>;
};

/** Native call hard cap — plugin budgets ~2.6s itself; this only guards a hung bridge. */
const NATIVE_OCR_CAP_MS = 4500;

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
  score?: number;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function fromParsed(parsed: ParsedMoneyAmount, text: string, engine: string): LocalReceiptParse {
  return {
    text: text.slice(0, 4000),
    engine,
    amount: parsed.amount,
    merchant: parsed.merchant,
    description: parsed.description,
    paymentMethod: parsed.paymentMethod,
    entryType: parsed.entryType === 'in' ? 'in' : 'out',
    date: parsed.date,
    confidence: parsed.confidence,
    score: parsed.score,
  };
}

/** Extract rupee / INR amounts from UPI screenshots, SMS, and receipt OCR. */
export function parseUpiAmountFromText(text: string): LocalReceiptParse | null {
  const parsed = extractMoneyAmount(text);
  if (!parsed) return null;
  return fromParsed(parsed, text, 'local-rules');
}

export async function recognizeDocumentText(
  base64: string,
  mimeType = 'image/jpeg',
): Promise<{ text: string; altText: string; engine: string }> {
  const clean = String(base64 || '').replace(/^data:[^;]+;base64,/i, '').replace(/\s+/g, '');
  if (!clean || clean.length < 64) return { text: '', altText: '', engine: 'empty' };

  if (Capacitor.isNativePlatform()) {
    try {
      const result = await Promise.race([
        DocumentOcr.recognizeBase64({ base64: clean, mimeType }),
        new Promise<null>((resolve) => { window.setTimeout(() => resolve(null), NATIVE_OCR_CAP_MS); }),
      ]);
      if (!result) return { text: '', altText: '', engine: 'native-timeout' };
      return {
        text: String(result.text || '').trim(),
        altText: String(result.altText || '').trim(),
        engine: String(result.engine || 'mlkit'),
      };
    } catch {
      return { text: '', altText: '', engine: 'mlkit-failed' };
    }
  }
  return { text: '', altText: '', engine: 'web-skip' };
}

/** Pass original bytes to native OCR (native decoder sizes to ~1920). No JS re-JPEG. */
export async function prepareOcrImage(dataUrl: string, mimeType = 'image/jpeg'): Promise<{ base64: string; mime: string }> {
  const clean = String(dataUrl || '').replace(/^data:[^;]+;base64,/i, '').replace(/\s+/g, '');
  const isPdf = mimeType === 'application/pdf' || /^JVBER/i.test(clean.slice(0, 16));
  if (isPdf || !mimeType.startsWith('image/')) {
    return { base64: clean, mime: isPdf ? 'application/pdf' : mimeType };
  }
  return {
    base64: clean,
    mime: mimeType.startsWith('image/') ? mimeType : 'image/jpeg',
  };
}

/** OCR image then deterministically parse amount / merchant. */
export async function localParseReceiptImage(
  base64: string,
  mimeType = 'image/jpeg',
  hintText = '',
): Promise<LocalReceiptParse | null> {
  const fromHint = parseUpiAmountFromText(hintText);
  const ocr = await recognizeDocumentText(base64, mimeType);
  const fromPrimary = parseUpiAmountFromText(ocr.text);
  // Second engine (ML Kit alongside PP-OCRv4): use it when primary missed the amount or the
  // two agree / alt is clearly stronger. Never merge texts — that double-counts multi-entry rows.
  const fromAlt = ocr.altText ? parseUpiAmountFromText(ocr.altText) : null;
  let fromOcr = fromPrimary;
  let ocrText = ocr.text;
  if (fromAlt && fromAlt.amount > 0) {
    const primaryWeak = !fromPrimary || !(fromPrimary.amount > 0)
      || (fromPrimary.confidence === 'low' && Number(fromPrimary.score || 0) < 40);
    const altStronger = preferMoneyParse(fromPrimary, fromAlt) === fromAlt
      && (Number(fromAlt.score || 0) - Number(fromPrimary?.score || 0)) >= 12;
    // PP-OCRv4 has no ₹ glyph (₹1,000 → "71000"); ML Kit does. A text that actually contains ₹
    // beats one where the parser had to guess which digit used to be the rupee sign.
    const altHasRupee = /₹/.test(ocr.altText) && !/₹/.test(ocr.text);
    if (primaryWeak || altStronger || altHasRupee) {
      fromOcr = fromAlt;
      ocrText = ocr.altText;
    }
  } else if ((!fromPrimary || !(fromPrimary.amount > 0)) && ocr.altText && !ocr.text) {
    ocrText = ocr.altText;
  }
  // Prefer higher confidence/score — NEVER the larger rupee value.
  const best = preferMoneyParse(fromOcr, fromHint);
  if (!best || !(best.amount > 0)) {
    if (ocrText) {
      return {
        text: ocrText.slice(0, 4000),
        engine: ocr.engine,
        amount: 0,
        merchant: '',
        description: 'Shared receipt',
        paymentMethod: 'upi',
        entryType: 'out',
        date: todayIso(),
        confidence: 'low',
        score: 0,
      };
    }
    return fromHint;
  }
  return {
    ...best,
    text: [hintText, ocrText].filter(Boolean).join('\n').slice(0, 4000),
    engine: ocr.engine === 'ppocrv4' || ocr.engine === 'mlkit'
      ? `${ocr.engine}+rules`
      : best.engine,
    confidence: best.confidence === 'high'
      || ((ocr.engine === 'ppocrv4' || ocr.engine === 'mlkit') && best.score && best.score >= 48)
      ? 'high'
      : best.confidence,
  };
}

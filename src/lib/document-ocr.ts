/**
 * Local document OCR + deterministic amount parse.
 * Native PP-OCRv4 (Paddle-Lite) first on Android; ML Kit fallback; no Gemini on share.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';
import { extractMoneyAmount, preferMoneyParse, type ParsedMoneyAmount } from './amount-parse';

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

/** Light resize for OCR only — keep digits sharp (separate from upload compress). PDFs pass through untouched. */
export async function prepareOcrImage(dataUrl: string, mimeType = 'image/jpeg'): Promise<{ base64: string; mime: string }> {
  const clean = String(dataUrl || '').replace(/^data:[^;]+;base64,/i, '').replace(/\s+/g, '');
  const isPdf = mimeType === 'application/pdf' || /^JVBER/i.test(clean.slice(0, 16));
  if (isPdf || !mimeType.startsWith('image/')) {
    return { base64: clean, mime: isPdf ? 'application/pdf' : mimeType };
  }
  const fallback = () => ({
    base64: clean,
    mime: mimeType.startsWith('image/') ? mimeType : 'image/jpeg',
  });
  if (typeof document === 'undefined') return fallback();
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
    const next = canvas.toDataURL('image/jpeg', 0.9);
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
  // Prefer higher confidence/score — NEVER the larger rupee value.
  const best = preferMoneyParse(fromOcr, fromHint);
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
        score: 0,
      };
    }
    return fromHint;
  }
  return {
    ...best,
    text: [hintText, ocr.text].filter(Boolean).join('\n').slice(0, 4000),
    engine: ocr.engine === 'ppocrv4' || ocr.engine === 'mlkit'
      ? `${ocr.engine}+rules`
      : best.engine,
    confidence: best.confidence === 'high'
      || ((ocr.engine === 'ppocrv4' || ocr.engine === 'mlkit') && best.score && best.score >= 48)
      ? 'high'
      : best.confidence,
  };
}

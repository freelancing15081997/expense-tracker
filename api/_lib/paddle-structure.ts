/**
 * PaddleOCR / PP-Structure–style structured extraction for Indian receipts,
 * GST invoices, UPI screenshots, bills and statements.
 *
 * Priority (error.txt): rules → PP-Structure fields → Gemini fallback.
 * Optional remote OCR: set PADDLE_OCR_URL to a HTTP endpoint that accepts
 * { imageBase64, mimeType } and returns { text, lines?, tables? }.
 */

import { extractMoneyAmount } from './amount-parse.js';

export type PpStructureResult = {
  amount: number;
  date: string;
  merchant: string;
  description: string;
  category: string;
  entryType: 'in' | 'out' | 'transfer';
  paymentMethod: string;
  invoiceNumber?: string;
  gstin?: string;
  taxAmount?: number;
  engine: string;
  confidence: 'high' | 'medium' | 'low';
  rawText?: string;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function toNum(raw: string) {
  const n = Number(String(raw || '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : NaN;
}

/** Detect complex / structured Indian financial documents that benefit from PP-Structure. */
export function needsPpStructure(input: {
  mimeType?: string;
  fileName?: string;
  text?: string;
  imageBase64Length?: number;
}) {
  const mime = String(input.mimeType || '').toLowerCase();
  const name = String(input.fileName || '').toLowerCase();
  const text = String(input.text || '');
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return true;
  if ((input.imageBase64Length || 0) > 900_000) return true;
  if (/\bgstin\b|\bcgst\b|\bsgst\b|\bigst\b|\btax\s*invoice\b|\bhsn\b/i.test(text)) return true;
  if (/\binvoice\s*no|\bbill\s*no|\bgrand\s*total\b|\bnet\s*payable\b/i.test(text)) return true;
  if ((text.match(/\n/g) || []).length >= 18) return true;
  return false;
}

function parseIndianDate(text: string): string | null {
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmy = text.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
  if (dmy) {
    const d = dmy[1].padStart(2, '0');
    const m = dmy[2].padStart(2, '0');
    let y = dmy[3];
    if (y.length === 2) y = `20${y}`;
    if (Number(y) >= 2000 && Number(y) <= 2100) return `${y}-${m}-${d}`;
  }

  const mon = text.match(
    /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{2,4})\b/i,
  );
  if (mon) {
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    };
    const key = mon[2].slice(0, 3).toLowerCase();
    let y = mon[3];
    if (y.length === 2) y = `20${y}`;
    return `${y}-${months[key]}-${mon[1].padStart(2, '0')}`;
  }
  return null;
}

function pickLabeledAmount(text: string): { amount: number; score: number } | null {
  // Downgrade balance / available balance so debit totals win on SMS.
  const balPenalty = /\b(?:avl|available|closing|opening)\s*bal(?:ance)?\b/i;
  const curr = String.raw`(?:₹|₨|rs\.?|inr|rupees?)`;
  const docHasRupee = new RegExp(curr, 'i').test(text);

  const patterns: Array<{ re: RegExp; score: number; requireCurrency: boolean }> = [
    { re: new RegExp(String.raw`(?:grand\s*total|net\s*payable|amount\s*payable|total\s*amount|amount\s*paid|invoice\s*value|bill\s*amount|you\s*paid)\s*[:\-]?\s*${curr}\s*([\d,]+(?:\.\d{1,2})?)`, 'gi'), score: 94, requireCurrency: true },
    { re: new RegExp(String.raw`(?:paid\s*successfully|payment\s*successful)\s*[:\-]?\s*${curr}\s*([\d,]+(?:\.\d{1,2})?)`, 'gi'), score: 92, requireCurrency: true },
    { re: new RegExp(String.raw`(?:debited\s*(?:by|from)?|credited\s*(?:by|to|from)?|payment\s*of|money\s*sent)\s*${curr}\s*([\d,]+(?:\.\d{1,2})?)`, 'gi'), score: 96, requireCurrency: true },
    { re: new RegExp(String.raw`(?:total\s*due|net\s*amount)\s*[:\-]?\s*${curr}\s*([\d,]+(?:\.\d{1,2})?)`, 'gi'), score: 90, requireCurrency: true },
    { re: new RegExp(String.raw`${curr}\s*([\d,]+(?:\.\d{1,2})?)`, 'gi'), score: 78, requireCurrency: true },
    { re: new RegExp(String.raw`([\d,]+(?:\.\d{1,2})?)\s*${curr}\b`, 'gi'), score: 76, requireCurrency: true },
    // No-currency labeled totals — only when document has no ₹ mark.
    { re: /(?:grand\s*total|net\s*payable|amount\s*payable|total\s*amount|bill\s*amount)\s*[:\-]?\s*([\d,]+(?:\.\d{1,2})?)/gi, score: 50, requireCurrency: false },
  ];
  let best: { amount: number; score: number } | null = null;
  for (const { re, score, requireCurrency } of patterns) {
    if (requireCurrency === false && docHasRupee) continue;
    const clone = new RegExp(re.source, re.flags);
    let m: RegExpExecArray | null;
    while ((m = clone.exec(text)) !== null) {
      const token = m[1];
      const n = toNum(token);
      if (!Number.isFinite(n) || n < 1 || n >= 5_000_000) continue;
      if (score < 70 && Number.isInteger(n) && n >= 1900 && n <= 2100) continue;
      const around = text.slice(Math.max(0, m.index - 3), Math.min(text.length, m.index + token.length + 3));
      if (/\d{1,2}:\d{2}/.test(around)) continue;
      const context = text.slice(Math.max(0, m.index - 24), Math.min(text.length, m.index + token.length + 8));
      let s = score;
      if (balPenalty.test(context)) s -= 40;
      if (/\b(?:sub\s*total|subtotal|cgst|sgst|igst|discount)\b/i.test(context)) s -= 10;
      if (score < 68 && Number.isInteger(n) && n <= 99) continue;
      if (!best || s > best.score) best = { amount: n, score: s };
      else if (s === best.score && /\.\d{1,2}$/.test(token)) best = { amount: n, score: s };
    }
  }
  return best;
}

function pickTax(text: string): number | undefined {
  const m = text.match(/(?:cgst\s*\+?\s*sgst|total\s*tax|gst\s*amount|igst)\s*[:\-]?\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)/i)
    || text.match(/\bcgst\b[^0-9]{0,12}([\d,]+(?:\.\d{1,2})?)/i);
  if (!m) return undefined;
  const n = toNum(m[1]);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function pickGstin(text: string): string | undefined {
  const m = text.match(/\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]\b/i);
  return m ? m[0].toUpperCase() : undefined;
}

function pickInvoice(text: string): string | undefined {
  const m = text.match(/(?:invoice\s*(?:no|number|#)|bill\s*(?:no|number|#)|receipt\s*(?:no|number|#))\s*[:\-]?\s*([A-Z0-9\-\/]{3,24})/i);
  return m ? m[1].trim() : undefined;
}

function pickMerchant(text: string): string {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const skip = /^(tax\s*invoice|retail\s*invoice|invoice|bill|receipt|original|customer|copy|gstin|date|time|total|amount|paid|thank)/i;
  for (const line of lines.slice(0, 8)) {
    if (skip.test(line)) continue;
    if (/^[\d₹rs.,\s\-:/]+$/i.test(line)) continue;
    if (line.length < 2 || line.length > 48) continue;
    if (/\b(?:upi|@ok|@ybl|gpay|phonepe|paytm)\b/i.test(line)) continue;
    return line.replace(/\s+/g, ' ').slice(0, 80);
  }
  const upi = text.match(/\b(?:to|paid to|sent to)\s+([A-Za-z0-9 .&'@_-]{2,48})/i);
  return upi?.[1]?.trim().slice(0, 80) || '';
}

function categoryFrom(text: string, merchant: string): string {
  const hay = `${merchant} ${text}`.toLowerCase();
  if (/swiggy|zomato|restaurant|cafe|meal|food|dominos|mcdonald|biryani/.test(hay)) return 'Meals';
  if (/fuel|petrol|diesel|hpcl|iocl|bpcl|shell|indian oil/.test(hay)) return 'Fuel';
  if (/uber|ola|irctc|makemytrip|indigo|flight|railway|metro|travel/.test(hay)) return 'Travel';
  if (/apollo|pharma|hospital|clinic|medical|1mg|netmeds/.test(hay)) return 'Health';
  if (/bescom|electricity|broadband|jio|airtel|vi |vodafone|water board|gas cylinder/.test(hay)) return 'Utilities';
  if (/bigbasket|blinkit|dmart|reliance fresh|grocer/.test(hay)) return 'Groceries';
  if (/amazon|flipkart|myntra|ajio|shopping|mall/.test(hay)) return 'Shopping';
  if (/netflix|spotify|prime|subscription|saas|software/.test(hay)) return 'Software Subscriptions';
  return 'Uncategorized';
}

function paymentFrom(text: string): string {
  if (/\bupi\b|@ok|@ybl|@axl|gpay|phonepe|paytm|bhim/i.test(text)) return 'upi';
  if (/\bcard\b|visa|mastercard|rupay|credit\s*card|debit\s*card/i.test(text)) return 'card';
  if (/\bneft\b|\bimps\b|\brtgs\b|bank\s*transfer/i.test(text)) return 'bank';
  if (/\bwallet\b|paytm\s*wallet/i.test(text)) return 'wallet';
  return 'cash';
}

/**
 * PP-Structure–style field mapping from OCR / document text (Indian formats).
 */
export function parsePpStructureText(text: string, fileName = ''): PpStructureResult | null {
  const raw = String(text || '').replace(/\u00a0/g, ' ').trim();
  if (!raw || raw.length < 8) return null;

  const labeled = pickLabeledAmount(raw);
  const fallback = extractMoneyAmount(raw);
  const amount = labeled?.amount || fallback?.amount || 0;
  if (!(amount > 0)) return null;

  const merchant = pickMerchant(raw) || String(fileName || '').replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim();
  const date = parseIndianDate(raw) || fallback?.date || todayIso();
  const invoiceNumber = pickInvoice(raw);
  const gstin = pickGstin(raw);
  const taxAmount = pickTax(raw);
  const paymentMethod = paymentFrom(raw) || fallback?.paymentMethod || 'cash';
  const entryType = fallback?.entryType === 'in' || /\b(?:refund|credited|money\s*received)\b/i.test(raw)
    ? 'in'
    : 'out';
  const category = categoryFrom(raw, merchant);
  const description = [merchant, invoiceNumber ? `Inv ${invoiceNumber}` : '']
    .filter(Boolean)
    .join(' · ')
    .slice(0, 160) || 'Shared receipt';

  const confidence: PpStructureResult['confidence'] =
    labeled && labeled.score >= 85
      ? 'high'
      : labeled || (fallback && fallback.confidence === 'high')
        ? 'medium'
        : 'low';

  return {
    amount,
    date,
    merchant: merchant.slice(0, 120),
    description,
    category,
    entryType,
    paymentMethod,
    invoiceNumber,
    gstin,
    taxAmount,
    engine: 'pp-structure',
    confidence,
    rawText: raw.slice(0, 2000),
  };
}

/** Optional remote PaddleOCR HTTP service. */
export async function runRemotePaddleOcr(input: {
  imageBase64: string;
  mimeType?: string;
  timeoutMs?: number;
}): Promise<{ text: string; engine: string } | null> {
  const url = String(process.env.PADDLE_OCR_URL || '').trim();
  if (!url) return null;
  const rawB64 = String(input.imageBase64 || '').replace(/^data:[^;]+;base64,/i, '').replace(/\s+/g, '');
  if (!rawB64 || rawB64.length < 64) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(5_000, Number(input.timeoutMs || 25_000)));
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        imageBase64: rawB64,
        mimeType: input.mimeType || 'image/jpeg',
      }),
    });
    if (!res.ok) return null;
    const payload = await res.json().catch(() => ({})) as { text?: string; lines?: string[] };
    const text = String(payload.text || (Array.isArray(payload.lines) ? payload.lines.join('\n') : '')).trim();
    if (!text) return null;
    return { text, engine: 'paddleocr-remote' };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Full pipeline step: remote PaddleOCR (if configured) then PP-Structure field mapping.
 */
export async function enrichWithPpStructure(input: {
  text?: string;
  imageBase64?: string;
  mimeType?: string;
  fileName?: string;
}): Promise<PpStructureResult | null> {
  let text = String(input.text || '').trim();
  let enginePrefix = '';

  if ((!text || text.length < 40) && input.imageBase64) {
    const remote = await runRemotePaddleOcr({
      imageBase64: input.imageBase64,
      mimeType: input.mimeType,
    });
    if (remote?.text) {
      text = remote.text;
      enginePrefix = remote.engine;
    }
  }

  const parsed = parsePpStructureText(text, input.fileName);
  if (!parsed) return null;
  return {
    ...parsed,
    engine: enginePrefix ? `${enginePrefix}+pp-structure` : parsed.engine,
  };
}

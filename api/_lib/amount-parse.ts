/**
 * Server-side mirror of src/lib/amount-parse.ts — keep logic in sync.
 * Never pick largest number; prefer labeled payment totals; never date-day or masked UPI as amount.
 */

export type ParsedMoneyAmount = {
  amount: number;
  entryType: 'in' | 'out' | 'transfer';
  description: string;
  merchant: string;
  paymentMethod: string;
  date: string;
  confidence: 'high' | 'medium' | 'low';
  score: number;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function toNum(raw: string) {
  const n = Number(String(raw || '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : NaN;
}

function isPlausibleAmount(n: number, opts?: { labeled?: boolean; hasDecimals?: boolean }) {
  if (!Number.isFinite(n) || n < 1 || n >= 5_000_000) return false;
  if (n >= 1900 && n <= 2100 && Number.isInteger(n)) return false;
  if (!opts?.labeled && Number.isInteger(n) && n <= 31 && !opts?.hasDecimals) return false;
  return true;
}

type Hit = { amount: number; score: number; index: number; labeled: boolean };

/** Masked UPI ID / A/c ending / VPA tail — never money. */
export function isDecoyAmountContext(raw: string, index: number, token: string): boolean {
  const before = raw.slice(Math.max(0, index - 28), index);
  const after = raw.slice(index + token.length, Math.min(raw.length, index + token.length + 28));
  const around = `${before}${token}${after}`;
  const digits = String(token).replace(/\D/g, '');

  if (/^\s*@[a-z0-9.\-]{2,}/i.test(after)) return true;
  if (/[a-z0-9]\s*$/i.test(before) && /^\s*@[a-z]/i.test(after) && !/(?:₹|rs\.?|inr)/i.test(around)) return true;
  if (/[x*]{2,}\s*$/i.test(before)) return true;
  if (/[x*]{2,}\d*$/i.test(`${before}${token}`)) return true;
  if (/\b(?:ending(?:\s+in|\s+with)?|ends?\s+with|a\/c|a\.c\.|account|acc(?:ount)?\.?|card|upi\s*id|vpa|mobile|phone)\b/i.test(before)
    && !/(?:₹|rs\.?|inr)/i.test(around)) {
    return true;
  }
  if (digits.length >= 8 && !/(?:₹|rs\.?|inr)/i.test(around)) return true;
  if (/\b(?:ref(?:erence)?|upi|utr|txn|transaction\s*id|rrn|order\s*id)\b/i.test(before)
    && !/(?:₹|rs\.?|inr)/i.test(around)) {
    return true;
  }
  return false;
}

export function amountAppearsAsRupee(text: string, amount: number): boolean {
  if (!(amount > 0) || !text) return false;
  const raw = String(text).replace(/\u00a0/g, ' ');
  const variants = new Set<string>();
  const push = (v: string) => {
    const t = String(v || '').trim();
    if (t) variants.add(t);
  };
  push(String(amount));
  if (Number.isInteger(amount)) push(amount.toFixed(0));
  else {
    push(amount.toFixed(2));
    push(amount.toFixed(1));
  }
  try {
    push(amount.toLocaleString('en-IN'));
    push(amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  } catch {
    /* ignore */
  }

  for (const v of variants) {
    const esc = v
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/,/g, '[,]?');
    const re = new RegExp(
      `(?:₹|rs\\.?|inr)\\s*${esc}\\b|\\b${esc}\\s*(?:₹|rs\\.?|inr)\\b`,
      'i',
    );
    if (re.test(raw)) return true;
  }
  return false;
}

export function extractMoneyAmount(text: string): ParsedMoneyAmount | null {
  const raw = String(text || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  if (!raw) return null;

  const hits: Hit[] = [];
  const push = (token: string, score: number, index: number, labeled: boolean) => {
    const n = toNum(token);
    const hasDecimals = /\.\d{1,2}$/.test(token);
    if (!isPlausibleAmount(n, { labeled, hasDecimals })) return;
    if (isDecoyAmountContext(raw, index, token)) return;

    const window = raw.slice(Math.max(0, index - 8), Math.min(raw.length, index + token.length + 12));
    if (/(?:\d{1,2}[\/\-.\s]\d{1,2}[\/\-.\s]\d{2,4})|(?:\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b)/i.test(window)
      && !labeled) {
      return;
    }
    const around = raw.slice(Math.max(0, index - 4), Math.min(raw.length, index + token.length + 4));
    if (/\d{1,2}:\d{2}/.test(around)) return;

    if (Number.isInteger(n) && n <= 31 && !hasDecimals) {
      const curr = raw.slice(Math.max(0, index - 28), Math.min(raw.length, index + token.length + 10));
      if (!/(?:₹|rs\.?|inr)/i.test(curr)) return;
    }

    let s = score;
    if (hasDecimals) s += 6;
    if (!labeled && Number.isInteger(n) && n <= 9) s -= 18;
    const ctx = raw.slice(Math.max(0, index - 28), Math.min(raw.length, index + token.length + 8));
    if (/\b(?:avl|available|closing|opening)\s*bal/i.test(ctx)) s -= 40;
    if (/\b(?:debited|credited|paid|sent|you\s+paid)\b/i.test(ctx)) s += 8;
    if (hasDecimals && /(?:₹|rs\.?|inr)/i.test(ctx)) s += 4;
    hits.push({ amount: n, score: s, index, labeled });
  };

  const walk = (re: RegExp, score: number, labeled: boolean) => {
    const clone = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
    let m: RegExpExecArray | null;
    while ((m = clone.exec(raw)) !== null) {
      const token = String(m[1] || '');
      const amountIndex = m.index + Math.max(0, m[0].lastIndexOf(token));
      push(token, score, amountIndex, labeled);
    }
  };

  walk(/(?:you\s+paid|paid\s+successfully|successfully\s+paid|amount\s+paid|total\s+paid)\s*[:\-]?\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)/gi, 56, true);
  walk(/(?:paid|sent|debited|spent|you\s+sent)\s*[:\-]?\s*(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/gi, 54, true);
  walk(/(?:debited\s+(?:by|from)|credited\s+(?:by|to|from)|payment\s+of)\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)/gi, 58, true);
  walk(/(?:payment\s+successful)\s*[:\-]?\s*(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/gi, 54, true);
  walk(/(?:grand\s*total|net\s*payable|amount\s*payable|total\s*due|invoice\s*value|total\s*amount)\s*[:\-]?\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)/gi, 50, true);
  walk(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:paid|sent|debited)/gi, 60, true);
  walk(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/gi, 28, false);
  walk(/([\d,]+(?:\.\d{1,2})?)\s*(?:₹|rs\.?|inr)\b/gi, 26, false);

  if (!hits.length) {
    const loose = /\b([\d,]{1,}(?:\.\d{1,2})?)\b/g;
    let m: RegExpExecArray | null;
    while ((m = loose.exec(raw)) !== null) {
      const n = toNum(m[1]);
      if (n >= 32 && n <= 200_000) push(m[1], 4, m.index, false);
    }
  }

  if (!hits.length) return null;
  const labeled = hits.filter((h) => h.labeled && h.score >= 48);
  const currency = hits.filter((h) => h.score >= 26);
  const pool = labeled.length ? labeled : (currency.length ? currency : hits);
  pool.sort((a, b) => b.score - a.score || a.index - b.index);
  const best = pool[0];

  const inMatch = /\b(?:credited|received|refund|money in|salary)\b/i.test(raw);
  const outMatch = /\b(?:debited|paid|spent|sent to|money out|payment successful)\b/i.test(raw);
  const transferMatch = /\btransfer\b/i.test(raw);
  let entryType: 'in' | 'out' | 'transfer' = 'out';
  if (inMatch && !outMatch) entryType = 'in';
  else if (transferMatch) entryType = 'transfer';

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

  const confidence: ParsedMoneyAmount['confidence'] =
    best.labeled || best.score >= 48 ? 'high' : best.score >= 26 ? 'medium' : 'low';

  return {
    amount: best.amount,
    entryType,
    description: (merchant || raw.slice(0, 80)).slice(0, 200),
    merchant: merchant.slice(0, 120),
    paymentMethod,
    date: todayIso(),
    confidence,
    score: best.score,
  };
}

export function reconcileVisionAmount(
  visionAmount: number,
  text: string,
  textParsed?: ParsedMoneyAmount | null,
): number {
  const vision = Number(visionAmount || 0);
  const parsed = textParsed && textParsed.amount > 0 ? textParsed : extractMoneyAmount(text);
  const textAmt = parsed && parsed.amount > 0 ? parsed.amount : 0;
  if (!(vision > 0) && !(textAmt > 0)) return 0;
  if (!(vision > 0)) return textAmt;
  if (!(textAmt > 0)) return vision;
  if (vision === textAmt) return vision;

  const visionInRupee = amountAppearsAsRupee(text, vision);
  const textInRupee = amountAppearsAsRupee(text, textAmt);
  const textStrong = Boolean(parsed && (parsed.score >= 26 || parsed.confidence === 'high' || parsed.confidence === 'medium'));

  if (!visionInRupee && textInRupee) return textAmt;
  if (!visionInRupee && textStrong) return textAmt;
  if (parsed && parsed.score >= 48) return textAmt;
  return vision;
}

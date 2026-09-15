/**
 * Canonical money-amount extraction for UPI screenshots, SMS, OCR, receipts.
 * Never picks “largest number wins” — that turns ₹1 into ₹5 from UI chrome.
 */

export type AmountHit = {
  amount: number;
  score: number;
  index: number;
  labeled: boolean;
};

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
  // Years / OCR junk
  if (n >= 1900 && n <= 2100 && Number.isInteger(n)) return false;
  // Calendar day / month fragments (e.g. "26 Sep") — never treat as rupees unless labeled+currency.
  if (!opts?.labeled && Number.isInteger(n) && n <= 31 && !opts?.hasDecimals) return false;
  return true;
}

/**
 * Ranked amount parse. Prefer labeled payment totals over bare ₹ and never
 * break ties by taking the larger number.
 */
export function extractMoneyAmount(text: string): ParsedMoneyAmount | null {
  const raw = String(text || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  if (!raw) return null;

  const hits: AmountHit[] = [];
  const push = (token: string, score: number, index: number, labeled: boolean) => {
    const n = toNum(token);
    const hasDecimals = /\.\d{1,2}$/.test(token);
    if (!isPlausibleAmount(n, { labeled, hasDecimals })) return;
    // Skip numbers that sit inside a date fragment (26/09/2024, 26 Sep, Sep 26).
    const window = raw.slice(Math.max(0, index - 8), Math.min(raw.length, index + token.length + 12));
    if (/(?:\d{1,2}[\/\-.\s]\d{1,2}[\/\-.\s]\d{2,4})|(?:\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b)/i.test(window)
      && !labeled) {
      return;
    }
    // Skip clock times (18:42) and UPI-ref fragments without currency.
    const around = raw.slice(Math.max(0, index - 4), Math.min(raw.length, index + token.length + 4));
    if (/\d{1,2}:\d{2}/.test(around)) return;
    if (!labeled && /\b(?:ref|upi|utr|txn|id)\b/i.test(raw.slice(Math.max(0, index - 20), index))) {
      if (Number.isInteger(n) || String(token).replace(/\D/g, '').length >= 8) return;
    }
    // "Payment successful 26" is a status + day — never ₹26 unless currency is present.
    if (Number.isInteger(n) && n <= 31 && !hasDecimals) {
      const curr = raw.slice(Math.max(0, index - 28), Math.min(raw.length, index + token.length + 10));
      if (!/(?:₹|rs\.?|inr)/i.test(curr)) return;
    }
    let s = score;
    if (hasDecimals) s += 6;
    if (!labeled && Number.isInteger(n) && n <= 9) s -= 18;
    // Prefer debit/credit over available balance in bank SMS.
    const ctx = raw.slice(Math.max(0, index - 28), Math.min(raw.length, index + token.length + 8));
    if (/\b(?:avl|available|closing|opening)\s*bal/i.test(ctx)) s -= 40;
    if (/\b(?:debited|credited|paid|sent)\b/i.test(ctx)) s += 8;
    hits.push({ amount: n, score: s, index, labeled });
  };

  const walk = (re: RegExp, score: number, labeled: boolean) => {
    const clone = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
    let m: RegExpExecArray | null;
    while ((m = clone.exec(raw)) !== null) {
      const token = String(m[1] || '');
      // Index of the amount digits — not the verb phrase start (fixes "Payment successful ₹26").
      const amountIndex = m.index + Math.max(0, m[0].lastIndexOf(token));
      push(token, score, amountIndex, labeled);
    }
  };

  // Strongest: explicit payment verbs next to the amount.
  walk(/(?:you\s+paid|paid\s+successfully|successfully\s+paid|amount\s+paid|total\s+paid)\s*[:\-]?\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)/gi, 56, true);
  // Require currency after bare paid/sent — avoids "Paid on 26 Sep".
  walk(/(?:paid|sent|debited|spent|you\s+sent)\s*[:\-]?\s*(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/gi, 54, true);
  walk(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:paid|sent|debited)/gi, 60, true);
  walk(/(?:debited\s+(?:by|from)|credited\s+(?:by|to|from)|payment\s+of)\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)/gi, 58, true);
  walk(/(?:payment\s+successful)\s*[:\-]?\s*(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/gi, 54, true);
  walk(/(?:grand\s*total|net\s*payable|total\s*due|invoice\s*value)\s*[:\-]?\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)/gi, 50, true);

  // Currency-marked amounts (still better than naked digits).
  walk(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/gi, 28, false);
  walk(/([\d,]+(?:\.\d{1,2})?)\s*(?:₹|rs\.?|inr)\b/gi, 26, false);

  // Only if nothing currency-like was found — still never take bare day-of-month.
  if (!hits.length) {
    const loose = new RegExp(/\b([\d,]{1,}(?:\.\d{1,2})?)\b/g);
    let m: RegExpExecArray | null;
    while ((m = loose.exec(raw)) !== null) {
      const n = toNum(m[1]);
      if (n >= 32 && n <= 200_000) push(m[1], 4, m.index, false);
    }
  }

  if (!hits.length) return null;

  const labeled = hits.filter((h) => h.labeled && h.score >= 48);
  const pool = labeled.length ? labeled : hits;

  // Highest score wins; ties → earlier on screen (hero amount), NEVER larger amount.
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

/** Pick between two parses by confidence/score — never by larger rupee value. */
export function preferMoneyParse<T extends { amount: number; confidence?: string; score?: number }>(
  a: T | null | undefined,
  b: T | null | undefined,
): T | null {
  if (a && !(a.amount > 0)) a = null;
  if (b && !(b.amount > 0)) b = null;
  if (!a) return b || null;
  if (!b) return a;
  const rank = (p: T) => {
    const c = String(p.confidence || '');
    const conf = c === 'high' ? 30 : c === 'medium' ? 15 : 0;
    return conf + Number(p.score || 0);
  };
  return rank(a) >= rank(b) ? a : b;
}

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

function isPlausibleAmount(n: number) {
  if (!Number.isFinite(n) || n < 1 || n >= 5_000_000) return false;
  // Years / OCR junk
  if (n >= 1900 && n <= 2100 && Number.isInteger(n)) return false;
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
    if (!isPlausibleAmount(n)) return;
    let s = score;
    if (/\.\d{1,2}$/.test(token)) s += 6; // 1.00 beats bare chrome digits
    // Tiny integers without decimals are often UI chrome when unlabeled.
    if (!labeled && Number.isInteger(n) && n <= 9) s -= 18;
    hits.push({ amount: n, score: s, index, labeled });
  };

  const walk = (re: RegExp, score: number, labeled: boolean) => {
    const clone = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
    let m: RegExpExecArray | null;
    while ((m = clone.exec(raw)) !== null) {
      const token = String(m[1] || '');
      push(token, score, m.index, labeled);
    }
  };

  // Strongest: explicit payment verbs next to the amount.
  walk(/(?:you\s+paid|paid\s+successfully|successfully\s+paid|amount\s+paid|total\s+paid)\s*[:\-]?\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)/gi, 56, true);
  walk(/(?:paid|sent|debited|spent|you\s+sent)\s*[:\-]?\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)/gi, 52, true);
  walk(/(?:debited\s+by|credited\s+by|payment\s+of|payment\s+successful|grand\s*total|net\s*payable|total\s*due)\s*[:\-]?\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)/gi, 50, true);
  walk(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:paid|sent|debited)/gi, 48, true);

  // Currency-marked amounts (still better than naked digits).
  walk(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/gi, 28, false);
  walk(/([\d,]+(?:\.\d{1,2})?)\s*(?:₹|rs\.?|inr)\b/gi, 26, false);

  // Only if nothing currency-like was found.
  if (!hits.length) {
    const loose = new RegExp(/\b([\d,]{1,}(?:\.\d{1,2})?)\b/g);
    let m: RegExpExecArray | null;
    while ((m = loose.exec(raw)) !== null) {
      const n = toNum(m[1]);
      // Require a normal spend range; skip single-digit chrome.
      if (n >= 10 && n <= 200_000) push(m[1], 4, m.index, false);
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

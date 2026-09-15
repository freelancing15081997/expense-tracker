/**
 * Server-side mirror of src/lib/amount-parse.ts — keep logic in sync.
 * Never pick largest number; prefer labeled payment totals.
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

function isPlausibleAmount(n: number) {
  if (!Number.isFinite(n) || n < 1 || n >= 5_000_000) return false;
  if (n >= 1900 && n <= 2100 && Number.isInteger(n)) return false;
  return true;
}

type Hit = { amount: number; score: number; index: number; labeled: boolean };

export function extractMoneyAmount(text: string): ParsedMoneyAmount | null {
  const raw = String(text || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  if (!raw) return null;

  const hits: Hit[] = [];
  const push = (token: string, score: number, index: number, labeled: boolean) => {
    const n = toNum(token);
    if (!isPlausibleAmount(n)) return;
    let s = score;
    if (/\.\d{1,2}$/.test(token)) s += 6;
    if (!labeled && Number.isInteger(n) && n <= 9) s -= 18;
    hits.push({ amount: n, score: s, index, labeled });
  };

  const walk = (re: RegExp, score: number, labeled: boolean) => {
    const clone = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
    let m: RegExpExecArray | null;
    while ((m = clone.exec(raw)) !== null) {
      push(String(m[1] || ''), score, m.index, labeled);
    }
  };

  walk(/(?:you\s+paid|paid\s+successfully|successfully\s+paid|amount\s+paid|total\s+paid)\s*[:\-]?\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)/gi, 56, true);
  walk(/(?:paid|sent|debited|spent|you\s+sent)\s*[:\-]?\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)/gi, 52, true);
  walk(/(?:debited\s+by|credited\s+by|payment\s+of|payment\s+successful|grand\s*total|net\s*payable|total\s*due)\s*[:\-]?\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)/gi, 50, true);
  walk(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:paid|sent|debited)/gi, 48, true);
  walk(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/gi, 28, false);
  walk(/([\d,]+(?:\.\d{1,2})?)\s*(?:₹|rs\.?|inr)\b/gi, 26, false);

  if (!hits.length) {
    const loose = /\b([\d,]{1,}(?:\.\d{1,2})?)\b/g;
    let m: RegExpExecArray | null;
    while ((m = loose.exec(raw)) !== null) {
      const n = toNum(m[1]);
      if (n >= 10 && n <= 200_000) push(m[1], 4, m.index, false);
    }
  }

  if (!hits.length) return null;
  const labeled = hits.filter((h) => h.labeled && h.score >= 48);
  const pool = labeled.length ? labeled : hits;
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

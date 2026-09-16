/**
 * Canonical money-amount extraction for UPI screenshots, SMS, OCR, receipts.
 * Never picks “largest number wins” — that turns ₹1 into ₹5 from UI chrome.
 * Never treats masked UPI / account-ending digits (e.g. XX112@oksbi) as money.
 * When any ₹ / Rs / INR mark exists, ONLY currency-marked amounts are candidates.
 */

export type AmountHit = {
  amount: number;
  score: number;
  index: number;
  labeled: boolean;
  /** True when the match includes ₹ / Rs / INR / rupee next to the digits. */
  hasCurrency: boolean;
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

/** Currency tokens OCR commonly emits for the Indian rupee. */
export const RUPEE_TOKEN = String.raw`(?:₹|₨|rs\.?|inr|rupees?)`;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function toNum(raw: string) {
  const n = Number(String(raw || '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : NaN;
}

function indianGroup(intStr: string) {
  if (intStr.length <= 3) return intStr;
  const last3 = intStr.slice(-3);
  const head = intStr.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${head},${last3}`;
}

function usGroup(intStr: string) {
  return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function hasIndianGrouping(token: string) {
  return /^\d{1,2}(,\d{2})+,\d{3}(?:\.\d{1,2})?$/.test(String(token || '').trim());
}

function isPlausibleAmount(n: number, opts?: { labeled?: boolean; hasDecimals?: boolean; hasCurrency?: boolean; token?: string }) {
  if (!Number.isFinite(n) || n < 1 || n >= 5_000_000) return false;
  const intDigits = String(Math.trunc(n)).length;
  // Card / account / UTR length — never money even with a stray ₹ nearby.
  if (intDigits >= 12) return false;
  // Years / OCR junk
  if (n >= 1900 && n <= 2100 && Number.isInteger(n) && !opts?.hasCurrency && !opts?.labeled) return false;
  // Calendar day / month fragments (e.g. "26 Sep") — never treat as rupees unless currency.
  if (!opts?.hasCurrency && !opts?.labeled && Number.isInteger(n) && n <= 31 && !opts?.hasDecimals) return false;
  return true;
}

const ID_LABEL_RE = /\b(?:customer\s*(?:id|no|number|code|identification)|cust(?:omer)?\s*(?:id|no|number)|client\s*(?:id|code|no)|member\s*(?:id|no)|consumer\s*(?:id|no|number)|card\s*(?:no|number|#|num)|pan\s*(?:no|number)|aadhaar|aadhar|cif|crn|folio|policy\s*(?:no|number)|application\s*(?:no|id)|booking\s*(?:id|no)|order\s*(?:id|no)|txn(?:saction)?\s*(?:id|no)|utr|rrn|cheque\s*(?:no|number)|account\s*(?:no|number|#)|a\/c\s*(?:no|number)|mobile\s*(?:no|number)|phone\s*(?:no|number)|pin\s*code|hsn|sac|invoice\s*(?:no|number|#)|bill\s*(?:no|number|#)|vehicle\s*(?:no|number)|chassis|engine\s*no)\b/gi;
const MONEY_LABEL_RE = /\b(?:grand\s*total|net\s*payable|amount\s*payable|total\s*amount|bill\s*amount|amount\s*paid|amount\s*due|balance\s*due|net\s*amount|invoice\s*value|you\s+paid|total\s*due|total\s*paid|paid\s*successfully|successfully\s*paid|debited|credited|amount|total)\b/gi;

function lastMatchIndex(re: RegExp, s: string): number {
  const clone = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
  let last = -1;
  let m: RegExpExecArray | null;
  while ((m = clone.exec(s)) !== null) last = m.index;
  return last;
}

function closestLabelIsId(before: string): boolean {
  const idAt = lastMatchIndex(ID_LABEL_RE, before);
  const moneyAt = lastMatchIndex(MONEY_LABEL_RE, before);
  if (idAt < 0) return false;
  return idAt >= moneyAt;
}

/** True when this token sits inside a PAN/card digit run (4111 1111 1111 1111 or 16-digit). */
function isInsideCardNumber(raw: string, index: number, token: string): boolean {
  const span = raw.slice(Math.max(0, index - 24), Math.min(raw.length, index + token.length + 24));
  if (/\b(?:\d{4}[\s-]){3}\d{4}\b/.test(span)) return true;
  if (/\b\d{13,19}\b/.test(span.replace(/[\s-]/g, ''))) {
    const compact = span.replace(/[\s-]/g, '');
    if (/\d{13,19}/.test(compact) && token.replace(/\D/g, '').length <= 6) return true;
  }
  return false;
}

/** True when `amount` actually appears in document text (never trust hallucinated vision). */
export function amountGroundedInText(text: string, amount: number): boolean {
  if (!(amount > 0) || !text) return false;
  const raw = String(text).replace(/\u00a0/g, ' ');
  const intPart = Math.trunc(amount);
  const cents = Math.round(Math.abs(amount - intPart) * 100);
  const intStr = String(intPart);
  const tails = cents > 0
    ? [`\\.${String(cents).padStart(2, '0')}`, `\\.${cents}`, '']
    : ['', '\\.00', '\\.0'];
  const bodies = [...new Set([intStr, indianGroup(intStr), usGroup(intStr)])]
    .map((b) => b.replace(/,/g, ',?'));
  for (const body of bodies) {
    for (const tail of tails) {
      const re = new RegExp(`(?<!\\d)${body}${tail}(?!\\d)`);
      if (re.test(raw)) return true;
    }
  }
  return false;
}

function matchHasCurrency(fullMatch: string): boolean {
  return new RegExp(RUPEE_TOKEN, 'i').test(fullMatch);
}

/** True when the document text contains any rupee/INR mark at all. */
export function textHasRupeeMark(text: string): boolean {
  return new RegExp(RUPEE_TOKEN, 'i').test(String(text || ''));
}

/** Masked UPI ID / A/c ending / VPA tail — never money. */
export function isDecoyAmountContext(raw: string, index: number, token: string): boolean {
  const before = raw.slice(Math.max(0, index - 48), index);
  const after = raw.slice(index + token.length, Math.min(raw.length, index + token.length + 28));
  const around = `${before}${token}${after}`;
  const digits = String(token).replace(/\D/g, '');
  const currRe = new RegExp(RUPEE_TOKEN, 'i');

  if (isInsideCardNumber(raw, index, token)) return true;

  // Closest label wins: "Customer ID 8821" is an ID; "Amount 400" is money.
  if (closestLabelIsId(before) && !currRe.test(around.slice(-24))) return true;

  // VPA: 112@oksbi / xx112@ybl / user112@paytm
  if (/^\s*@[a-z0-9.\-]{2,}/i.test(after)) return true;
  if (/[a-z0-9]\s*$/i.test(before) && /^\s*@[a-z]/i.test(after) && !currRe.test(around)) return true;

  // Masked digits: XXXXX112, ******112, xx112
  if (/[x*]{2,}\s*$/i.test(before)) return true;
  if (/[x*]{2,}\d*$/i.test(`${before}${token}`)) return true;

  // Account / card-number / UPI ending fragments — not “CREDIT CARD” as a biller category.
  if (/\b(?:ending(?:\s+in|\s+with)?|ends?\s+with|a\/c|a\.c\.|account|acc(?:ount)?\.?|card\s*(?:no|number|#|ending)|upi\s*id|vpa|mobile|phone)\b/i.test(before)
    && !currRe.test(around)) {
    return true;
  }

  // Long reference / phone-like digit runs without currency (IDs, UTRs, cards).
  if (digits.length >= 8 && !currRe.test(around) && !hasIndianGrouping(token)) return true;

  // UTR / txn / ref keywords immediately before
  if (/\b(?:ref(?:erence)?|upi|utr|txn|transaction\s*id|rrn|order\s*id)\b/i.test(before)
    && !currRe.test(around)) {
    return true;
  }

  // Qty / items / page / GSTIN / invoice-no fragments without currency
  if (/\b(?:qty|quantity|pcs?|items?|page|pg|gstin|hsn|sac|invoice\s*(?:no|number|#)|bill\s*(?:no|number|#))\b/i.test(before)
    && !currRe.test(around)) {
    return true;
  }
  // Bare "Bill 334455" receipt numbers (not "Retail bill … Amount 400")
  if (/\bbill\s+$/i.test(before) && digits.length >= 4 && !currRe.test(around)) return true;

  return false;
}

/** True when amount appears next to ₹ / Rs / INR in text (corroboration for vision). */
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
      `${RUPEE_TOKEN}\\s*${esc}\\b|\\b${esc}\\s*${RUPEE_TOKEN}\\b`,
      'i',
    );
    if (re.test(raw)) return true;
  }
  return false;
}

/**
 * Ranked amount parse. Prefer ₹/Rs/INR marked totals over every other number.
 * Never break ties by taking the larger number.
 */
function normalizeOcrMoneyText(text: string) {
  let s = String(text || '').replace(/\u00a0/g, ' ');
  // OCR often emits ₹ as a lone “2” or “4” between Amount and the digits (₹ → 4).
  s = s.replace(/\bamount\s+[24]\s+(?=[\d,])/gi, 'amount ₹ ');
  s = s.replace(/\bamount\s+[24](1,?00,?000|[\d,]{5,7})(?!\d)/gi, 'amount ₹ $1');
  // Indian grouping with spaces: 1 00 000 → 1,00,000
  s = s.replace(/\b(\d{1,2})\s+(\d{2})\s+(\d{3})(?!\d)/g, '$1,$2,$3');
  return s.replace(/\s+/g, ' ').trim();
}

export function extractMoneyAmount(text: string): ParsedMoneyAmount | null {
  const raw = normalizeOcrMoneyText(text);
  if (!raw) return null;
  const docHasRupee = textHasRupeeMark(raw);

  const hits: AmountHit[] = [];
  const push = (token: string, score: number, index: number, labeled: boolean, hasCurrency: boolean) => {
    const n = toNum(token);
    const hasDecimals = /\.\d{1,2}$/.test(token);
    if (!isPlausibleAmount(n, { labeled, hasDecimals, hasCurrency, token })) return;
    // OCR of ₹ as “4” / “2” must not become a ₹4 labeled total.
    if (labeled && !hasCurrency && !hasDecimals && Number.isInteger(n) && n <= 9) return;
    if (isDecoyAmountContext(raw, index, token)) return;

    // Skip numbers that sit inside a date fragment (26/09/2024, 26 Sep, Sep 26).
    const window = raw.slice(Math.max(0, index - 8), Math.min(raw.length, index + token.length + 12));
    if (/(?:\d{1,2}[\/\-.\s]\d{1,2}[\/\-.\s]\d{2,4})|(?:\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b)/i.test(window)
      && !hasCurrency) {
      return;
    }
    // Skip clock times (18:42).
    const around = raw.slice(Math.max(0, index - 4), Math.min(raw.length, index + token.length + 4));
    if (/\d{1,2}:\d{2}/.test(around)) return;

    // Calendar day next to “Payment successful 26” — never ₹26 unless labeled or currency.
    if (Number.isInteger(n) && n <= 31 && !hasDecimals && !hasCurrency && !labeled) {
      return;
    }

    let s = score;
    if (hasCurrency) s += 18;
    if (hasDecimals) s += 6;
    if (!labeled && !hasCurrency && Number.isInteger(n) && n <= 9) s -= 18;
    const ctx = raw.slice(Math.max(0, index - 28), Math.min(raw.length, index + token.length + 8));
    if (/\b(?:avl|available|closing|opening)\s*bal/i.test(ctx)) s -= 40;
    if (/\b(?:debited|credited|paid|sent|you\s+paid)\b/i.test(ctx)) s += 8;
    if (hasDecimals && hasCurrency) s += 4;
    if (hasIndianGrouping(token)) s += 10;
    // Subtotal / tax lines lose to grand total / you paid.
    if (/\b(?:sub\s*total|subtotal|cgst|sgst|igst|taxable|discount|qty)\b/i.test(ctx) && !/\b(?:grand\s*total|net\s*payable|you\s+paid|amount\s*paid)\b/i.test(ctx)) {
      s -= 12;
    }
    hits.push({ amount: n, score: s, index, labeled, hasCurrency });
  };

  const walk = (re: RegExp, score: number, labeled: boolean) => {
    const clone = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
    let m: RegExpExecArray | null;
    while ((m = clone.exec(raw)) !== null) {
      const token = String(m[1] || '');
      const amountIndex = m.index + Math.max(0, m[0].lastIndexOf(token));
      push(token, score, amountIndex, labeled, matchHasCurrency(m[0]));
    }
  };

  // Strongest: payment verbs WITH currency (required).
  walk(new RegExp(String.raw`(?:you\s+paid|paid\s+successfully|successfully\s+paid|amount\s+paid|total\s+paid)\s*[:\-]?\s*${RUPEE_TOKEN}\s*([\d,]+(?:\.\d{1,2})?)`, 'gi'), 56, true);
  walk(new RegExp(String.raw`(?:paid|sent|debited|spent|you\s+sent)\s*[:\-]?\s*${RUPEE_TOKEN}\s*([\d,]+(?:\.\d{1,2})?)`, 'gi'), 54, true);
  walk(new RegExp(String.raw`${RUPEE_TOKEN}\s*([\d,]+(?:\.\d{1,2})?)\s*(?:paid|sent|debited)`, 'gi'), 60, true);
  walk(new RegExp(String.raw`(?:debited\s+(?:by|from)|credited\s+(?:by|to|from)|payment\s+of)\s*${RUPEE_TOKEN}\s*([\d,]+(?:\.\d{1,2})?)`, 'gi'), 58, true);
  walk(new RegExp(String.raw`(?:payment\s+successful)\s*[:\-]?\s*${RUPEE_TOKEN}\s*([\d,]+(?:\.\d{1,2})?)`, 'gi'), 54, true);
  walk(new RegExp(String.raw`(?:grand\s*total|net\s*payable|amount\s*payable|total\s*due|invoice\s*value|total\s*amount|bill\s*amount)\s*[:\-]?\s*${RUPEE_TOKEN}\s*([\d,]+(?:\.\d{1,2})?)`, 'gi'), 52, true);

  // Labeled invoice totals without currency (PDF/OCR often drops ₹ or the colon).
  walk(/(?:grand\s*total|net\s*payable|amount\s*payable|total\s*due|invoice\s*value|total\s*amount|bill\s*amount|balance\s*due|amount\s*due|net\s*amount|amount\s*paid|total\s*paid)\s*[:\-]?\s*([\d,]+(?:\.\d{1,2})?)/gi, 40, true);
  walk(/(?:^|[^\w])(?:amount|total)\s*[:\-]?\s*([\d,]+(?:\.\d{1,2})?)/gi, 36, true);

  // Any currency-marked amount (hero ₹ on UPI screens).
  walk(new RegExp(String.raw`${RUPEE_TOKEN}\s*([\d,]+(?:\.\d{1,2})?)`, 'gi'), 28, false);
  walk(new RegExp(String.raw`([\d,]+(?:\.\d{1,2})?)\s*${RUPEE_TOKEN}\b`, 'gi'), 26, false);

  // Bare numbers ONLY when the document has no rupee/INR mark and no labeled total.
  const hasLabeled = hits.some((h) => h.labeled);
  if (!hits.some((h) => h.hasCurrency) && !docHasRupee && !hasLabeled) {
    const loose = new RegExp(/\b([\d,]{1,}(?:\.\d{1,2})?)\b/g);
    let m: RegExpExecArray | null;
    while ((m = loose.exec(raw)) !== null) {
      const n = toNum(m[1]);
      if (n >= 32 && n <= 200_000) push(m[1], 4, m.index, false, false);
    }
  }

  if (!hits.length) return null;

  // Labeled totals (Grand Total, Net Payable, …) beat random currency hits and bare digits.
  const labeledHits = hits.filter((h) => h.labeled);
  const currencyHits = hits.filter((h) => h.hasCurrency);
  let pool: AmountHit[];
  if (labeledHits.length) {
    pool = labeledHits;
  } else if (currencyHits.length) {
    pool = currencyHits;
  } else if (!docHasRupee) {
    pool = hits;
  } else {
    return null;
  }

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
    best.hasCurrency && (best.labeled || best.score >= 48)
      ? 'high'
      : best.hasCurrency || best.score >= 26
        ? 'medium'
        : 'low';

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

/**
 * Prefer OCR/text labeled ₹ amount when vision invents a decoy (masked UPI tail, etc.).
 */
export function reconcileVisionAmount(
  visionAmount: number,
  text: string,
  textParsed?: ParsedMoneyAmount | null,
): number {
  const parsed = textParsed && textParsed.amount > 0 ? textParsed : extractMoneyAmount(text);
  const textAmt = parsed && parsed.amount > 0 ? parsed.amount : 0;
  let vision = Number(visionAmount || 0);
  // Never keep a model-invented number that is not on the document.
  if (vision > 0 && text && !amountGroundedInText(text, vision)) vision = 0;
  if (textAmt > 0 && text && !amountGroundedInText(text, textAmt)) {
    return vision > 0 ? vision : 0;
  }
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
  if (textInRupee && !visionInRupee) return textAmt;
  return textAmt;
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

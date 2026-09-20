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

/** Currency tokens OCR commonly emits (INR + common foreign codes on shared receipts). */
// Alphabetic codes need boundaries — otherwise "HARSHINI" (rs), "Farm" (rm), "FIRST" contain a "currency".
export const RUPEE_TOKEN = String.raw`(?:₹|₨|(?<![A-Za-z])(?:rs\.?|inr|rupees?|rm|egp|npr|mmk|usd)(?![A-Za-z])|\$|€|£)`;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const MONTH_NUM: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function ymd(year: number, month: number, day: number): string {
  let y = year;
  if (y < 100) y += y >= 70 ? 1900 : 2000;
  if (y < 2000 || y > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return '';
  return `${y}-${pad2(month)}-${pad2(day)}`;
}

function monthFromName(token: string): number {
  const key = String(token || '').replace(/\./g, '').slice(0, 3).toLowerCase();
  return MONTH_NUM[key] || 0;
}

/** Receipt / UPI screenshot date → ISO YYYY-MM-DD. Falls back to today. */
export function extractReceiptDate(text: string): string {
  const raw = String(text || '');
  if (!raw.trim()) return todayIso();

  const named = raw.match(/\b(\d{1,2})\s*([A-Za-z]{3,9})\.?\s*,?\s*(\d{4})\b/);
  if (named) {
    const iso = ymd(Number(named[3]), monthFromName(named[2]), Number(named[1]));
    if (iso) return iso;
  }
  const namedRev = raw.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?\s*,?\s*(\d{4})\b/);
  if (namedRev) {
    const iso = ymd(Number(namedRev[3]), monthFromName(namedRev[1]), Number(namedRev[2]));
    if (iso) return iso;
  }
  const labeled = raw.match(/\b(?:date|dated|on)\s*[:\-]?\s*(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/i);
  if (labeled) {
    const iso = ymd(Number(labeled[3]), Number(labeled[2]), Number(labeled[1]));
    if (iso) return iso;
  }
  const dm = raw.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
  if (dm) {
    const iso = ymd(Number(dm[3]), Number(dm[2]), Number(dm[1]));
    if (iso) return iso;
  }
  return todayIso();
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
  // Allow up to ₹10 crore when currency/label present (GPay hero); else keep 50L ceiling.
  const max = (opts?.hasCurrency || opts?.labeled) ? 100_000_000 : 5_000_000;
  if (!Number.isFinite(n) || n < 1 || n >= max) return false;
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
const MONEY_LABEL_RE = /\b(?:grand\s*total|food\s*total|net\s*payable|amount\s*payable|total\s*amount|total\s*payment|collected\s*amount|bill\s*amount|amount\s*paid|amount\s*due|balance\s*due|net\s*amount|invoice\s*value|you\s+paid|total\s*due|total\s*paid|paid\s*successfully|successfully\s*paid|payment\s*successful|debited|credited|amount\s*\(\s*(?:rs|npr)\s*\)|amount|total|amt|योग)\b/gi;

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
  // Ground against the repaired text too — "71000" is how PP-OCR spells ₹1,000.
  const raw = `${String(text).replace(/\u00a0/g, ' ')}\n${repairOcrText(text)}`;
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

  // Qty / items / page / GSTIN / invoice-no fragments without currency — only when that
  // label is closer than a real money total label (otherwise "Item … Grand Total 177" dies).
  const decoyAt = lastMatchIndex(/\b(?:qty|quantity|pcs?|items?|page|pg|gstin|hsn|sac|invoice\s*(?:no|number|#)|bill\s*(?:no|number|#))\b/gi, before);
  const moneyAt = lastMatchIndex(MONEY_LABEL_RE, before);
  if (decoyAt >= 0 && decoyAt > moneyAt && !currRe.test(around)) {
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

/** UPI / wallet / bill-app screens — digital text that ALWAYS prints ₹ before an amount. */
const UPI_SCREEN_RE = /\b(?:paid\s+to|debited\s+from|transaction\s+successful|payment\s+successful|received\s+from|money\s+sent\s+to|upi\s+transaction\s+id|phonepe|gpay|g\s+pay|paytm|cred|upi)\b/i;
/** Line that opens a "Paid to / Debited from / amount" block whose value sits on a following line. */
const BLOCK_HEADER_RE = /^(?:paid\s+to|debited\s+from|received\s+from|money\s+sent\s+to|amount|amt)\b/i;

/**
 * Repair systematic on-device OCR damage BEFORE any amount logic runs.
 *
 * PP-OCRv4 (Chinese+ASCII dictionary) has no ₹ glyph: it emits ₹1,000 as "71000",
 * ₹10 as "210"/"710", ₹164 as "#164", ₹400 as "天400", ₹20,000 as "R20,000", or drops it.
 * It also glues words ("Paidto", "Collectedamount", "18,000MMK", "Paid50").
 * Line structure is preserved so callers can still reason per OCR line. Idempotent.
 */
/** Stable id of an OCR dump so a user correction can replay on the next similar share. */
export function ocrFingerprint(text: string): string {
  const s = repairOcrText(text).replace(/\s+/g, ' ').trim().toLowerCase();
  if (!s) return '';
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  const head = s.slice(0, 40).replace(/[^a-z0-9]+/g, '').slice(0, 16);
  const tail = s.slice(-32).replace(/[^a-z0-9]+/g, '').slice(-12);
  return `${head}_${(h >>> 0).toString(16)}_${s.length}_${tail}`;
}

export type LearnedParseHit = {
  amount: number;
  merchant?: string;
  entryType?: 'in' | 'out';
  extras?: Array<{ amount: number; merchant?: string; entryType?: 'in' | 'out' }>;
};

let learnedLookup: ((fp: string) => LearnedParseHit | null) | null = null;

/** Client registers a localStorage/API-backed map so mismatch corrections apply instantly. */
export function setLearnedParseLookup(fn: ((fp: string) => LearnedParseHit | null) | null) {
  learnedLookup = fn;
}

function fromLearned(text: string): ParsedMoneyAmount[] | null {
  if (!learnedLookup) return null;
  const fp = ocrFingerprint(text);
  if (!fp) return null;
  const hit = learnedLookup(fp);
  if (!hit || !(Number(hit.amount) > 0)) return null;
  const row = (amount: number, merchant?: string, entryType?: string): ParsedMoneyAmount => ({
    amount,
    merchant: String(merchant || ''),
    description: String(merchant || ''),
    entryType: entryType === 'in' ? 'in' : 'out',
    paymentMethod: 'upi',
    date: extractReceiptDate(text),
    confidence: 'high',
    score: 99,
  });
  const extras = Array.isArray(hit.extras) ? hit.extras.filter((e) => Number(e.amount) > 0) : [];
  if (extras.length >= 2) {
    return extras.map((e) => row(Number(e.amount), e.merchant, e.entryType));
  }
  return [row(Number(hit.amount), hit.merchant, hit.entryType)];
}

export function repairOcrText(text: string): string {
  let s = String(text || '').replace(/\u00a0/g, ' ').replace(/\r\n?/g, '\n');
  if (!s.trim()) return '';

  // --- 1. De-glue labels PP-OCR runs together. The char after the phrase must not be lowercase
  // ("PaidtoWinZO" → "paid to WinZO", but "paid total" stays). Done via callback because a
  // case-insensitive regex cannot express "not a lowercase letter".
  const deglue = (re: RegExp, phrase: string) => {
    s = s.replace(re, (_m: string, next: string) => (next && /[a-z]/.test(next) ? _m : `${phrase} ${next || ''}`));
  };
  deglue(/\b(?:paid|pald|pa1d|pa\.d)\s*to([A-Za-z]?)/gi, 'paid to');
  deglue(/\breceived\s*from([A-Za-z]?)/gi, 'received from');
  deglue(/\bmoney\s*sent\s*to([A-Za-z]?)/gi, 'money sent to');
  deglue(/\bmoney\s*transfer\s*failed\s*to([A-Za-z]?)/gi, 'money transfer failed to');
  s = s
    .replace(/\bdeb[il1]ted\s*fro[mn]\b/gi, 'debited from')
    .replace(/\btransaction\s*successful\b/gi, 'transaction successful')
    .replace(/\bpayment\s*successful\b/gi, 'payment successful')
    .replace(/\bcollected\s*amount\b/gi, 'collected amount')
    .replace(/\btotal\s*amount\b/gi, 'total amount')
    .replace(/\btotal\s*payment\b/gi, 'total payment')
    .replace(/\bamount\s*paid\b/gi, 'amount paid')
    .replace(/\bbill\s*amount\b/gi, 'bill amount')
    .replace(/\bgrand\s*total\b/gi, 'grand total')
    .replace(/\bfood\s*total\b/gi, 'food total')
    // Garbled "amount" label (amourt / ancunt / amout)
    .replace(/\b(?:amourt|amout|ancunt|amonut|arnount|amoumt|amourit)\b/gi, 'amount')
    // "Paid50" / "Total1381.00" / "Amount₹" → put the space back
    .replace(/\b(paid|total|amount|amt)(?=[\d₹])/gi, '$1 ');

  // --- 2. Currency codes glued to digits: "18,000MMK", "RM15.00", "Rs8.300.00"
  s = s
    .replace(/(\d)(?=(?:MMK|EGP|NPR|INR|USD|RM)\b)/g, '$1 ')
    .replace(/\b(RM|EGP|NPR|MMK|INR|Rs\.?)(?=\d)/g, '$1 ');
  // "Rs 8.300.00" / "Rs 16.750.00" → thousands dot is a misread comma.
  s = s.replace(/\b(\d{1,2})\.(\d{3})\.(\d{2})\b/g, '$1,$2.$3');

  // --- 3. Glyphs PP-OCR emits instead of ₹ (never digits themselves): 天 ￥ ¥ ? # ±
  // Guard: digits must not continue into an ID ("#2020-00108289" order number stays as-is).
  const MONEY_DIGITS = String.raw`(?=\d[\d,]{0,9}(?:\.\d{1,2})?(?![\d,.\-\/]))`;
  s = s.replace(new RegExp(String.raw`(^|[\s:+\-(])[天￥¥?#±]\s?${MONEY_DIGITS}`, 'gm'), '$1₹');
  // "R20,000" / "+R1" (₹ → R). Lookahead digit means "RM"/"Rs" are untouched.
  s = s.replace(new RegExp(String.raw`(^|[\s:+\-(])R${MONEY_DIGITS}`, 'gm'), '$1₹');
  // Lone "T182961" line (₹ → T). Line-anchored + ≤9 digits so txn IDs (T2609…22 digits) never match.
  s = s.replace(/^\s*T(\d{2,9}(?:\.\d{1,2})?)\s*$/gm, '₹$1');

  // --- 4. ₹ read as a digit ("71000" for ₹1,000) — only on UPI-style screens, only in amount blocks.
  if (UPI_SCREEN_RE.test(s)) {
    const lines = s.split('\n');
    const numLine = /^\s*([+-])?\s*(\d[\d,]*(?:\.\d{1,2})?)\s*$/;
    type NumLine = { i: number; sign: string; tok: string; int: string; inBlock: boolean };
    const nums: NumLine[] = [];
    for (let i = 0; i < lines.length; i += 1) {
      const m = lines[i].match(numLine);
      if (!m) continue;
      const prev1 = (lines[i - 1] || '').trim();
      const prev2 = (lines[i - 2] || '').trim();
      // "Paid to ¶ NAME ¶ 71000"  or  "Money sent to NAME ¶ -7195"  or  "amount ¶ 7182961"
      const inBlock = BLOCK_HEADER_RE.test(prev1)
        || (BLOCK_HEADER_RE.test(prev2) && /^[A-Za-z][A-Za-z0-9 .&'_-]*$/.test(prev1));
      nums.push({ i, sign: m[1] || '', tok: m[2], int: m[2].replace(/,/g, '').split('.')[0], inBlock });
    }
    const unmarkedBlock = nums.filter((n) => n.inBlock || n.sign).length;
    const rupeeMarks = (s.match(/₹|\brs\.?\s*\d|\binr\b/gi) || []).length;
    if (unmarkedBlock > 0 && rupeeMarks < unmarkedBlock + 1) {
      const successScreen = /\b(?:debited\s+from|transaction\s+successful|payment\s+successful)\b/i.test(s);
      const fixed = new Map<number, string>();
      const asIs = new Set<number>();
      // Success screens print the amount twice (Paid to ₹X … Debited from ₹X) — use one to repair the other.
      for (const a of nums) {
        for (const b of nums) {
          if (a === b) continue;
          if (a.int === b.int) { asIs.add(a.i); asIs.add(b.i); continue; }
          if (!successScreen) continue;
          if (a.int.length === b.int.length + 1 && a.int.endsWith(b.int) && /^[27]/.test(a.int)) {
            fixed.set(a.i, b.tok);
          } else if (
            a.int.length === b.int.length && a.int.length >= 2
            && a.int.slice(1) === b.int.slice(1) && /^[27]/.test(a.int) && /^[27]/.test(b.int)
            && !/^0/.test(a.int.slice(1))
          ) {
            fixed.set(a.i, a.int.slice(1));
            fixed.set(b.i, b.int.slice(1));
          }
        }
      }
      for (const n of nums) {
        if (!n.inBlock && !n.sign) continue;
        const prefix = n.sign ? `${n.sign} ` : '';
        if (fixed.has(n.i)) {
          lines[n.i] = `${prefix}₹${fixed.get(n.i)}`;
        } else if (/^7\d/.test(n.int) && !asIs.has(n.i) && !/^70/.test(n.int) && !/,/.test(n.tok)) {
          // Lone "7…" with no corroboration on a screen that must have shown ₹ → the 7 was the ₹.
          lines[n.i] = `${prefix}₹${n.tok.slice(1)}`;
        } else {
          lines[n.i] = `${prefix}₹${n.tok}`;
        }
      }
      s = lines.join('\n');
    }
  }
  return s;
}

/**
 * Ranked amount parse. Prefer ₹/Rs/INR marked totals over every other number.
 * Never break ties by taking the larger number.
 */
function normalizeOcrMoneyText(text: string) {
  let s = repairOcrText(text);
  // OCR often emits ₹ as a lone “2” or “4” between Amount and the digits (₹ → 4).
  s = s.replace(/\bamount\s+[24]\s+(?=[\d,])/gi, 'amount ₹ ');
  s = s.replace(/\bamount\s+[24](1,?00,?000|[\d,]{5,7})(?!\d)/gi, 'amount ₹ $1');
  // European money "37,00" / "11,50" → 37.00 (not Indian 16,750 or 1,00,000).
  s = s.replace(/\b(\d{1,4}),(\d{2})(?![,\d])/g, '$1.$2');
  // Indian lac grouping with spaces: "1 00 000" → "1,00,000".
  // NEVER join arbitrary neighbors (e.g. "50 CGST 27 Grand Total 177" must not become 50,27,177).
  s = s.replace(/\b(\d{1,2})\s+(00)\s+(\d{3})(?!\d)/g, '$1,$2,$3');
  s = s.replace(new RegExp(`${RUPEE_TOKEN}\\s*(\\d{1,2})\\s+(\\d{2})\\s+(\\d{3})(?!\\d)`, 'gi'), (m) => {
    const parts = m.match(/(\d{1,2})\s+(\d{2})\s+(\d{3})/);
    if (!parts) return m;
    return m.replace(parts[0], `${parts[1]},${parts[2]},${parts[3]}`);
  });
  // Strip leading zeros on money tokens after labels: Amount(Rs) : 00590.00
  s = s.replace(
    /\b((?:amount\s*\(\s*rs\s*\)|amount|grand\s*total|food\s*total|net\s*payable|total|amt|योग))\s*[:\-]?\s*(?:₹|rs\.?)?\s*0+(\d+(?:\.\d{1,2})?)/gi,
    '$1 $2',
  );
  return s.replace(/\s+/g, ' ').trim();
}

export function extractMoneyAmount(text: string): ParsedMoneyAmount | null {
  const learned = fromLearned(text);
  if (learned?.[0]) return learned[0];
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
    const before = raw.slice(Math.max(0, index - 40), index);
    const after = raw.slice(index + token.length, Math.min(raw.length, index + token.length + 12));
    const ctx = `${before}${token}${after}`;
    if (/\b(?:avl|available|closing|opening)\s*bal/i.test(ctx)) s -= 40;
    if (/\b(?:debited|credited|paid|sent|you\s+paid|paid\s+to)\b/i.test(ctx)) s += 8;
    if (hasDecimals && hasCurrency) s += 4;
    if (hasIndianGrouping(token)) s += 10;
    // Cashback / reward chrome must lose to the real payment.
    if (/\b(?:cashback|reward|claim|expires?|unlocked)\b/i.test(ctx)) s -= 35;
    // Line rate / qty / fee columns — not the bill payable. Only when that column label is the
    // CLOSEST label ("Fee 100 MMK Total 18,000" must keep Total; "Bus Fee Rs 7,000" loses).
    const feeAt = lastMatchIndex(/\b(?:rate|qty|quantity|price|mrp|fees?|service\s*fees?|delivery|emi\s*collected|charges\s*collected|rc\s*amount)\b/gi, before);
    const payableAt = lastMatchIndex(/\b(?:grand\s*total|food\s*total|total\s*amount|total\s*payment|amount\s*paid|collected\s*amount|amount\s*\(|net\s*payable|योग|total|amount|amt)\b/gi, before);
    if (feeAt >= 0 && feeAt > payableAt) s -= 22;
    // Lifetime pump meters
    if (/\b(?:atot|vtot)\b/i.test(before)) s -= 50;
    // PhonePe / GPay History month chip ("Sep 2026 ₹1,54,010.75") — not a payment.
    if (/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{2,4}\b/i.test(before)
      && !/\bpaid\s+to\b/i.test(before.slice(-30))) {
      s -= 55;
    }
    // Penalize only when the closest label before the number is tax/qty — not when Grand Total is closer.
    const taxAt = lastMatchIndex(/\b(?:sub\s*total|subtotal|cgst|sgst|igst|gst|iva|vat|taxable|discount|qty|quantity|rate|mrp|unit\s*price|items?\s*total|concession)\b/gi, before);
    const totalAt = lastMatchIndex(/\b(?:grand\s*total|food\s*total|net\s*payable|amount\s*payable|you\s+paid|amount\s*paid|total\s*due|total\s*amount|bill\s*amount|amount\s*due|balance\s*due|net\s*amount|amount\s*\(\s*rs\s*\)|(?:^|[^\w])amount|(?:^|[^\w])total|amt|योग)\b/gi, before);
    if (taxAt >= 0 && taxAt > totalAt) s -= 28;
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
  // CRED / bill apps: explicit "amount ₹…" is the payable (not Customer ID / order ID).
  walk(new RegExp(String.raw`(?:^|[^\w])amount\s*[:\-]?\s*${RUPEE_TOKEN}\s*([\d,]+(?:\.\d{1,2})?)`, 'gi'), 66, true);
  walk(/(?:^|[^\w])amount\s*[:\-]?\s*([\d,]+(?:\.\d{1,2})?)/gi, 52, true);
  // Fuel / POS: Amount(Rs) / Amount(NPR)
  walk(new RegExp(String.raw`amount\s*\(\s*(?:rs|npr|inr)\s*\)\s*[:\-]?\s*${RUPEE_TOKEN}?\s*([\d,]+(?:\.\d{1,2})?)`, 'gi'), 68, true);
  walk(/amount\s*\(\s*(?:rs|npr|inr)\s*\)\s*[:\-]?\s*([\d,]+(?:\.\d{1,2})?)/gi, 66, true);
  // Restaurant payable labels (Food Total / Grand Total / AMT / योग)
  walk(new RegExp(String.raw`(?:food\s*total|grand\s*total|net\s*payable|योग)\s*[:\-]?\s*${RUPEE_TOKEN}?\s*([\d,]+(?:\.\d{1,2})?)`, 'gi'), 70, true);
  walk(/(?:food\s*total|grand\s*total|net\s*payable|योग)\s*[:\-]?\s*([\d,]+(?:\.\d{1,2})?)/gi, 68, true);
  // Collection / utility / wallet totals
  walk(new RegExp(String.raw`(?:total\s*payment|total\s*amount|collected\s*amount|amount\s*paid)\s*[:\-]?\s*${RUPEE_TOKEN}?\s*([\d,]+(?:\.\d{1,2})?)`, 'gi'), 68, true);
  walk(/(?:total\s*payment|total\s*amount|collected\s*amount|amount\s*paid)\s*[:\-]?\s*([\d,]+(?:\.\d{1,2})?)/gi, 66, true);
  // Payment successful hero (GPay / Scan & Pay / Paytm) — amount may be on next line
  walk(new RegExp(String.raw`(?:payment\s+successful|transaction\s+successful)[\s\S]{0,40}?${RUPEE_TOKEN}\s*([\d,]+(?:\.\d{1,2})?)`, 'gi'), 66, true);
  walk(new RegExp(String.raw`(?:^|[^\w])(?:amt|total)\s*[:\-]?\s*${RUPEE_TOKEN}?\s*([\d,]+(?:\.\d{1,2})?)`, 'gi'), 58, true);
  // PhonePe / GPay hero: Paid to NAME [vpa] ₹N (₹ optional when OCR drops it)
  walk(new RegExp(String.raw`paid\s+to\s+[A-Za-z0-9][A-Za-z0-9 .&'_-]{0,48}?(?:\s+[A-Za-z0-9._-]+@[A-Za-z0-9._-]+)?\s*${RUPEE_TOKEN}\s*([\d,]+(?:\.\d{1,2})?)`, 'gi'), 64, true);
  walk(/paid\s+to\s+[A-Za-z0-9][A-Za-z0-9 .&'_-]{0,48}?(?:\s+[A-Za-z0-9._-]+@[A-Za-z0-9._-]+)?\s+([\d,]+(?:\.\d{1,2})?)(?!\d)/gi, 56, true);
  // Debited from … ₹N (second amount on PhonePe success screen)
  walk(new RegExp(String.raw`debited\s+from[\s\S]{0,60}?${RUPEE_TOKEN}\s*([\d,]+(?:\.\d{1,2})?)`, 'gi'), 58, true);
  // True invoice footer totals (with ₹) — highest labeled invoice class.
  walk(new RegExp(String.raw`(?:amount\s*payable|total\s*due|invoice\s*value|total\s*amount|bill\s*amount|balance\s*due|amount\s*due)\s*[:\-]?\s*${RUPEE_TOKEN}\s*([\d,]+(?:\.\d{1,2})?)`, 'gi'), 64, true);

  // Same footer labels when OCR drops ₹.
  walk(/(?:amount\s*payable|total\s*due|invoice\s*value|total\s*amount|bill\s*amount|balance\s*due|amount\s*due|net\s*amount|amount\s*paid|total\s*paid)\s*[:\-]?\s*([\d,]+(?:\.\d{1,2})?)/gi, 50, true);
  // Bare "Total" without currency — still useful for cash memos, but below Food/Grand Total.
  walk(/(?:^|[^\w])total\s*[:\-]?\s*([\d,]+(?:\.\d{1,2})?)/gi, 44, true);
  // OCR column order flips value BEFORE its label: "5049.0 ¶ Collected amount", "17800 ¶ TOTAL".
  walk(new RegExp(String.raw`(?:^|[^\w₹])([\d,]+(?:\.\d{1,2})?)\s+(?:collected\s*amount|total\s*payment|grand\s*total|amount\s*paid|total\s*amount|net\s*payable)\b`, 'gi'), 62, true);
  walk(/(?:^|[^\w₹])([\d,]+(?:\.\d{1,2})?)\s+total\b(?!\s*(?:qty|items?|quantity))/gi, 44, true);
  // GPay "Paid 50" / PhonePe "Paid ₹…" when the ₹ was dropped entirely (digital screens only).
  if (!docHasRupee && UPI_SCREEN_RE.test(raw)) {
    walk(/\b(?:paid|sent|debited)\s+([\d,]+(?:\.\d{1,2})?)(?!\d)/gi, 50, true);
  }

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

  // Prefer strong labeled totals; never let weak "Total" beat Grand Total / Net Payable.
  const strongLabeled = hits.filter((h) => h.labeled && h.score >= 48);
  const labeledHits = strongLabeled.length ? strongLabeled : hits.filter((h) => h.labeled && h.score >= 30);
  const currencyHits = hits.filter((h) => h.hasCurrency);
  let pool: AmountHit[];
  if (labeledHits.length) {
    pool = labeledHits;
  } else if (currencyHits.length) {
    pool = currencyHits;
  } else if (!docHasRupee) {
    pool = hits;
  } else {
    // Only weak "Total N" hits left with ₹ elsewhere — refuse rather than guess a line item.
    const weakOnly = hits.filter((h) => h.labeled);
    if (weakOnly.length && !currencyHits.length) {
      // Still allow best weak labeled if nothing else — but require score floor via sort below.
      pool = weakOnly.filter((h) => h.score >= 20);
      if (!pool.length) return null;
    } else {
      return null;
    }
  }

  // Highest score wins. Ties: labeled → later on page (footer payable); currency → earlier (UPI hero).
  const labeledPool = pool.every((h) => h.labeled);
  pool.sort((a, b) => b.score - a.score || (labeledPool ? b.index - a.index : a.index - b.index));
  const best = pool[0];
  // Refuse posting a weak unlabeled/bare "total" when confidence would be garbage.
  if (best.labeled && best.score < 30 && !best.hasCurrency) return null;

  const inMatch = /\b(?:credited|received|refund|money in|salary)\b/i.test(raw);
  const outMatch = /\b(?:debited|paid|spent|sent to|money out|payment successful)\b/i.test(raw);
  const transferMatch = /\btransfer\b/i.test(raw);
  let entryType: 'in' | 'out' | 'transfer' = 'out';
  if (inMatch && !outMatch) entryType = 'in';
  else if (transferMatch) entryType = 'transfer';

  // Prefer Paid-to on its own OCR line (GPay/PhonePe) before flattened heuristics.
  const ocrLines = repairOcrText(text)
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  let lineMerchant = '';
  for (let i = 0; i < ocrLines.length; i += 1) {
    const l = ocrLines[i];
    if (/^paid\s+to\s+\S+/i.test(l)) {
      lineMerchant = cleanMerchantName(l.replace(/^paid\s+to\s+/i, ''));
      break;
    }
    // "Paid to" alone, merchant on the next line (PhonePe success layout)
    if (/^paid\s+to$/i.test(l) && ocrLines[i + 1]) {
      lineMerchant = cleanMerchantName(ocrLines[i + 1]);
      break;
    }
  }
  // GPay contact list: "RONTE VENKANNA ¶ ₹400" — payee is the name line right above the ₹ line.
  if (!lineMerchant && UPI_SCREEN_RE.test(raw) && !/\bcred\b/i.test(raw)) {
    for (let i = 1; i < ocrLines.length; i += 1) {
      if (!/^[+-]?\s*₹\s*[\d,]+(?:\.\d{1,2})?$/.test(ocrLines[i])) continue;
      const prev = ocrLines[i - 1];
      // Real names: two words or a long single token — not OCR crumbs like "srent".
      if (/^[A-Za-z][A-Za-z .&'-]{2,40}$/.test(prev) && (/\s/.test(prev) || prev.length >= 8)
        && !MERCHANT_CHROME_RE.test(prev) && !SKIP_NAME_RE.test(prev)) {
        lineMerchant = cleanMerchantName(prev);
        break;
      }
    }
  }

  const merchant = cleanMerchantName(lineMerchant)
    || cleanMerchantName(
      raw.match(/\bpaid\s+to\s+([A-Za-z][A-Za-z0-9 .&']{2,40}?)(?=\s*(?:[A-Za-z0-9._-]+@|₹|₨|rs\.?|inr|rm|egp|paid\b|today|yesterday|$))/i)?.[1]
      || raw.match(/\bto\s*:\s*([A-Za-z][A-Za-z0-9 .&']{1,40}?)(?=\s*(?:a\/c|\.|@|₹|rs\.?|$))/i)?.[1]
      || raw.match(/\breceiver\s*name\s*[:\-]?\s*([A-Za-z][A-Za-z0-9 .&']{1,40})/i)?.[1]
      || raw.match(/\b(?:sent to|received from|money\s+sent\s+to)\s+([A-Za-z][A-Za-z0-9 .&']{2,40}?)(?=\s+(?:[A-Za-z0-9._-]+@|₹|₨|rs\.?|today|yesterday|\d))/i)?.[1]
      || raw.match(/\b(?:customer\s*name|ordering\s+from)\s*[:\-]?\s*(?:mr\.?\s*)?([A-Za-z][A-Za-z0-9 .&']{1,40})/i)?.[1]
      || raw.match(/\b(breadfast|tvscredit|pipal\s+singh|prabhu\s+bank|eastern\s+power|aya\s+pay|upaisa|indian\s+curry\s+place)\b/i)?.[1]
      || '',
    );
  // Scan & Pay style: amount then ALL-CAPS payee (reject label words like CHARGES).
  // Use `i` so RM/EGP match; require capture to be truly uppercase so "Charges" is rejected.
  // Only on payment-app screens — on a cash memo "₹400 SEVTAMATAR" is just the next menu line.
  const capsPayee = !merchant && /\b(?:payment\s+successful|transaction\s+successful|scan\s*&?\s*pay)\b/i.test(raw)
    ? raw.match(new RegExp(`${RUPEE_TOKEN}\\s*[\\d,]+(?:\\.\\d{1,2})?\\s+([A-Z][A-Z0-9]{6,})(?:\\s|$)`, 'i'))?.[1]
    : '';
  const capsClean = capsPayee && capsPayee === capsPayee.toUpperCase()
    && !/^(?:CHARGES|COLLECTED|PAYMENT|TOTAL|AMOUNT|RECEIPT|SUCCESSFUL|REFERENCE|TRANSACTION|SOURCE|DELIVERY|SERVICE)\b/.test(capsPayee)
    ? capsPayee
    : '';
  let finalMerchant = merchant || cleanMerchantName(capsClean);
  let descriptionOverride = '';
  // CRED bill-payment receipt: biller bank is the useful name.
  if (!finalMerchant && /\bcred\b/i.test(raw) && /bill\s*payment/i.test(raw)) {
    const bank = raw.match(/\b(icici|hdfc|rbl|indusind|sbi|axis|kotak|idfc|yes|amex|citi|hsbc|au|federal|bob|pnb|canara|union|scb|onecard)\b/i)?.[1];
    finalMerchant = bank ? `${bank.toUpperCase()} Bank card (CRED)` : 'CRED card bill';
    descriptionOverride = 'Credit card bill via CRED';
  }
  // Paper receipts: the shop name is almost always the first clean text line.
  if (!finalMerchant) {
    for (const l of ocrLines.slice(0, 6)) {
      if (!/^[A-Za-z][A-Za-z &'-]{3,39}$/.test(l)) continue;
      if (MERCHANT_CHROME_RE.test(l) || SKIP_NAME_RE.test(l)) continue;
      finalMerchant = l.trim();
      break;
    }
  }

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
    description: (descriptionOverride || finalMerchant || raw.slice(0, 80)).slice(0, 200),
    merchant: finalMerchant.slice(0, 120),
    paymentMethod,
    date: extractReceiptDate(text),
    confidence,
    score: best.score,
  };
}

const SKIP_NAME_RE = /^(?:amount|total|grand|net|paid|date|order|payment|biller|category|customer|transaction|reference|debited|credited|balance|qty|quantity|items?|subtotal|cgst|sgst|igst|history|search|statements?|am|pm|failed|received|sent|today|yesterday)$/i;
/** App chrome / receipt boilerplate that is never a payee name (substring match — OCR glues words). */
const MERCHANT_CHROME_RE = /(?:receipt|invoice|memo|bill|duplicate|welcome|payment|transaction|estimate|history|successful|statement|balance|search|tax|gstin|cell|tel\b|mob\b|date|time|total|amount|details|order|thank|collected|name|student|customer|registration|branch|semester|particulars|description|product|price|rate\b|qty|home|alerts?|view|check|claim|reward|expires?|share|done|pay\b|debited|credited|from\b|powered|need help|composit|dealer)/i;

/** Strip UPI VPA / trailing junk from a Paid-to merchant string. */
export function cleanMerchantName(raw: string): string {
  let s = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  // PP-OCR drops spaces: "NunnaMaheshCar" → "Nunna Mahesh Car". Only glued multi-word names
  // (≥2 case humps, or one hump in a long token) — brands like "GoodenGates"/"WinZO" stay whole.
  if (!/\s/.test(s) && !/^[A-Z0-9._-]+$/.test(s)) {
    const humps = (s.match(/[a-z][A-Z]/g) || []).length;
    if (humps >= 2 || (humps === 1 && s.length >= 14)) s = s.replace(/([a-z])([A-Z])/g, '$1 $2');
  }
  // Cut at VPA / amount / debit chrome
  s = s.split(/@/)[0] || s;
  s = s.split(/\./)[0] || s;
  s = s.replace(/\s*(?:₹|₨|rs\.?|inr|rupees?|rm|egp|npr|mmk|\$|€|£)\s*[\d,].*$/i, '');
  s = s.replace(/\s+(?:debited|credited|upi|phonepe|gpay|paytm|transaction|payment\s+details|message|utr|bill\s*amount|a\/c|paid|essay|product|receipt\w*|bank\w*|agreement\w*)\b.*$/i, '');
  s = s.replace(/\s+(?:rs\.?|inr)\s*\d.*$/i, '');
  // Trailing VPA local-part when OCR drops "@ybl" (APOLLOPHARMACYOFFLINE). Case-sensitive so a
  // real surname like "KumarNagar" survives.
  s = s.replace(/\s+[A-Z0-9._-]{10,}(?:OFFLINE|ONLINE)?$/, '');
  s = s.replace(/[^\w .&'-]+$/g, '').replace(/\s+/g, ' ').trim();
  // Drop trailing time crumbs / Mr.
  s = s.replace(/^(?:mr\.?\s*)/i, '').replace(/\s+\d{1,2}:\d{2}\s*(?:am|pm)?$/i, '').trim();
  if (SKIP_NAME_RE.test(s) || s.length < 2) return '';
  if (/^(?:am|pm)$/i.test(s)) return '';
  return s.slice(0, 48);
}

/**
 * UPI History / PhonePe list: Paid to / Money sent / Received from — skip Failed rows.
 */
export function extractUpiHistoryEntries(text: string): ParsedMoneyAmount[] {
  const raw = normalizeOcrMoneyText(text);
  if (!raw) return [];
  const found: Array<ParsedMoneyAmount & { _i: number }> = [];
  const seen = new Set<string>();

  const push = (nameRaw: string, amountRaw: string, entryType: 'in' | 'out', index: number) => {
    const name = cleanMerchantName(nameRaw);
    const amount = toNum(amountRaw);
    if (!(amount > 0) || amount >= 100_000_000) return;
    if (!name || name.length < 2) return;
    if (SKIP_NAME_RE.test(name)) return;
    if (/^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{2,4}$/i.test(name)) return;
    const key = `${entryType}|${name.toLowerCase()}|${amount}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push({
      amount,
      entryType,
      description: name,
      merchant: name,
      paymentMethod: 'upi',
      date: extractReceiptDate(text),
      confidence: 'high',
      score: 60,
      _i: index,
    });
  };

  // Drop failed transfer blocks so their ₹ aren't paired with a later success row.
  const cleaned = raw.replace(/money\s+transfer\s+failed[\s\S]{0,160}?(?=(?:paid\s+to|money\s+sent|received\s+from|money\s+transfer\s+failed|$))/gi, ' ');

  const patterns: Array<{ re: RegExp; type: 'in' | 'out' }> = [
    {
      re: /paid\s+to\s+([A-Za-z][A-Za-z0-9 .&']{2,40}?)(?:\s+[A-Za-z0-9._-]+@[A-Za-z0-9._-]+)?(?:\s+(?:today|yesterday|\d{1,2}\s+[A-Za-z]{3})\b[^₹]{0,40})?\s*[-+]?\s*(?:₹|₨|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/gi,
      type: 'out',
    },
    {
      re: /money\s+sent\s+to\s+([A-Za-z][A-Za-z0-9 .&']{2,40}?)(?:\s+(?:today|yesterday|\d{1,2}\s+[A-Za-z]{3})\b[^₹]{0,40})?\s*[-+]?\s*(?:₹|₨|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/gi,
      type: 'out',
    },
    {
      re: /received\s+from\s+([A-Za-z][A-Za-z0-9 .&']{2,40}?)(?:\s+(?:today|yesterday|\d{1,2}\s+[A-Za-z]{3})\b[^₹]{0,40})?\s*[+]?\s*(?:₹|₨|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/gi,
      type: 'in',
    },
  ];

  for (const { re, type } of patterns) {
    const clone = new RegExp(re.source, re.flags);
    let m: RegExpExecArray | null;
    while ((m = clone.exec(cleaned)) !== null) {
      const window = cleaned.slice(Math.max(0, m.index - 40), m.index + m[0].length);
      if (/\bfailed\b/i.test(window)) continue;
      push(m[1], m[2], type, m.index);
    }
  }

  found.sort((a, b) => a._i - b._i);
  return found.length >= 2
    ? found.map(({ _i, ...rest }) => rest)
    : [];
}

/**
 * PhonePe / GPay History: many "Paid to NAME ₹N" rows on one screenshot.
 */
export function extractPaidToEntries(text: string): ParsedMoneyAmount[] {
  return extractUpiHistoryEntries(text).filter((e) => e.entryType === 'out');
}

/**
 * Multi-entry notes: "Seenu - Rs 1016" / "Raghu - Rs 5016" → one row each.
 * Requires an explicit dash/colon between name and money — never restaurant
 * "ITEM 2 ₹200" line-items (those are a single bill total).
 */
export function extractNamedMoneyLines(text: string): ParsedMoneyAmount[] {
  const raw = normalizeOcrMoneyText(text);
  if (!raw) return [];
  const found: ParsedMoneyAmount[] = [];
  const seen = new Set<string>();

  const pushNamed = (nameRaw: string, amountRaw: string) => {
    const name = cleanMerchantName(nameRaw);
    const amount = toNum(amountRaw);
    if (!(amount > 0) || amount >= 5_000_000) return;
    if (!name || name.length < 3 || name.length > 48) return;
    if (SKIP_NAME_RE.test(name)) return;
    if (/^(?:am|pm)$/i.test(name)) return;
    if (/^\d+$/.test(name)) return;
    // Reject qty-looking names ("2 HANDI", "Paneer 2")
    if (/\d/.test(name) && name.split(/\s+/).length <= 3) return;
    const key = `${name.toLowerCase()}|${amount}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push({
      amount,
      entryType: 'out',
      description: name,
      merchant: name,
      paymentMethod: 'cash',
      date: extractReceiptDate(text),
      confidence: 'high',
      score: 55,
    });
  };

  // Per line — dash/colon required (handwritten chit style).
  for (const line of repairOcrText(text).split(/\r?\n/)) {
    const t = line.replace(/\s+/g, ' ').trim();
    if (!t) continue;
    const m = t.match(
      /^([A-Za-z][A-Za-z0-9 .']{0,40}?)\s*[-–—:]\s*(?:₹|₨|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i,
    );
    if (m) pushNamed(m[1], m[2]);
  }

  // Flattened OCR: "Seenu - Rs 1016 /- Raghu - Rs 5016 /-"
  if (found.length < 2) {
    const globalRe = /([A-Za-z][A-Za-z0-9 .']{0,40}?)\s*[-–—:]\s*(?:₹|₨|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/gi;
    let m: RegExpExecArray | null;
    while ((m = globalRe.exec(raw)) !== null) {
      pushNamed(m[1], m[2]);
    }
  }

  return found.length >= 2 ? found : [];
}

/**
 * Prefer multi named lines / PhonePe History rows; else one payable total.
 */
export function extractMoneyEntries(text: string): ParsedMoneyAmount[] {
  const learned = fromLearned(text);
  if (learned?.length) return learned;
  const history = extractUpiHistoryEntries(text);
  if (history.length >= 2) return history;
  const multi = extractNamedMoneyLines(text);
  if (multi.length >= 2) return multi;
  const one = extractMoneyAmount(text);
  if (!one) return [];
  if (/\bpaid\s+to\b/i.test(repairOcrText(text))) {
    const raw = normalizeOcrMoneyText(text);
    const m = raw.match(/paid\s+to\s+([A-Za-z0-9][A-Za-z0-9 .&'_-]{0,48}?)(?:\s+[A-Za-z0-9._-]+@[A-Za-z0-9._-]+)?\s*(?:₹|₨|rs\.?|inr|\$|€|£)\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (m) {
      const name = cleanMerchantName(m[1]);
      const amount = toNum(m[2]);
      if (name && amount > 0) {
        return [{
          ...one,
          amount,
          merchant: name,
          description: name,
          paymentMethod: 'upi',
          confidence: 'high',
          score: Math.max(one.score, 62),
        }];
      }
    }
    const cleaned = cleanMerchantName(one.merchant);
    if (cleaned) {
      return [{ ...one, merchant: cleaned, description: cleaned, paymentMethod: one.paymentMethod || 'upi' }];
    }
  }
  return [{ ...one, merchant: cleanMerchantName(one.merchant) || one.merchant }];
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
